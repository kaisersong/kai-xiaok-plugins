/**
 * Canvas HTTP Server — standalone Node.js server
 *
 * Serves:
 * - REST API for canvas CRUD / selection / view-state
 * - SSE for real-time canvas change notifications
 * - Static files (dist/ frontend + canvas/assets/ images)
 * - Process lifecycle (PID file + health check + idle timeout)
 */

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat, rename, readdir, rm } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, resolve, extname, dirname, basename, relative, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pluginRoot = resolve(__dirname, '..')

// ── Config ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.KAI_CANVAS_PORT ?? '43217', 10)
const PROJECT_DIR = resolve(process.env.KAI_CANVAS_PROJECT_DIR ?? process.cwd())
const CANVAS_DIR = resolve(PROJECT_DIR, 'canvas')
const STATIC_DIR = resolve(process.env.KAI_CANVAS_STATIC_DIR ?? join(pluginRoot, 'dist'))

const PAGE_ID_PREFIX = 'page:'
const CANVAS_FILE_NAME = 'canvas.json'
const PAGES_DIR = join(CANVAS_DIR, 'pages')
const SELECTION_FILE = join(CANVAS_DIR, 'canvas-selection.json')
const VIEW_STATE_FILE = join(CANVAS_DIR, 'canvas-view-state.json')
const PAGES_MANIFEST = join(PAGES_DIR, 'manifest.json')
const GLOBAL_ASSETS_ROUTE = '/canvas-assets/'
const PAGE_ASSETS_ROUTE = '/page-assets/'

const MIME_TYPES = new Map([
  ['.apng', 'image/apng'], ['.avif', 'image/avif'], ['.gif', 'image/gif'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'],
  ['.html', 'text/html'], ['.js', 'text/javascript'], ['.mjs', 'text/javascript'],
  ['.css', 'text/css'], ['.json', 'application/json'], ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf'], ['.ico', 'image/x-icon'],
  ['.map', 'application/json'],
])

// ── SSE Clients ───────────────────────────────────────────────────────

const sseClients = new Set()
let canvasEventVersion = 0
let lastActivity = Date.now()

function broadcastCanvasChanged(source) {
  const payload = {
    version: ++canvasEventVersion,
    source,
    updatedAt: new Date().toISOString(),
  }
  for (const res of sseClients) {
    if (res.destroyed) { sseClients.delete(res); continue }
    try {
      res.write(`event: canvas-changed\n`)
      res.write(`id: ${payload.version}\n`)
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
    } catch { sseClients.delete(res) }
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────

function pidFilePath(port) {
  return join(tmpdir(), `kai-canvas-${port}.pid`)
}

async function writePidFile() {
  const content = JSON.stringify({ pid: process.pid, projectDir: PROJECT_DIR, port: PORT, startedAt: new Date().toISOString() })
  await writeFile(pidFilePath(PORT), content, 'utf8')
}

async function removePidFile() {
  try { await rm(pidFilePath(PORT), { force: true }) } catch {}
}

function checkProcessIsOurs(pid) {
  try {
    const cmd = process.platform === 'win32'
      ? `wmic process where processid=${pid} get commandline /format:list`
      : `ps -p ${pid} -o command=`
    const output = execSync(cmd, { encoding: 'utf8', timeout: 2000 })
    return output.includes('kai-canvas') || output.includes('canvas') || output.includes('server/index.mjs')
  } catch { return false }
}

// ── Helpers ───────────────────────────────────────────────────────────

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

async function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 50 * 1024 * 1024) { rejectBody(new Error('Payload too large')); req.destroy() }
    })
    req.on('end', () => resolveBody(body))
    req.on('error', rejectBody)
  })
}

async function atomicWrite(filePath, content) {
  await mkdir(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  await writeFile(tmp, content)
  await rename(tmp, filePath)
}

function isSafeChildPath(parent, child) {
  const rel = relative(parent, child)
  return rel && !rel.startsWith('..') && !rel.includes(`..${sep}`)
}

function pageDirName(pageId) {
  return encodeURIComponent(pageId.replace(PAGE_ID_PREFIX, ''))
}

function pageFilePath(pageId) {
  return join(PAGES_DIR, pageDirName(pageId), CANVAS_FILE_NAME)
}

function pageAssetsDir(pageId) {
  return join(PAGES_DIR, pageDirName(pageId), 'assets')
}

function pageAssetUrl(pageId, fileName) {
  return `${PAGE_ASSETS_ROUTE}${pageDirName(pageId)}/${encodeURIComponent(fileName)}`
}

function isSnapshot(value) {
  return value && typeof value === 'object' && value.store && value.schema
}

// ── Storage ───────────────────────────────────────────────────────────

function getPageRecords(snapshot) {
  return Object.values(snapshot.store)
    .filter(r => r?.typeName === 'page')
    .sort((a, b) => String(a.index ?? '').localeCompare(String(b.index ?? '')))
}

function getShapeRecordsForPage(snapshot, pageId) {
  const byParent = new Map()
  for (const record of Object.values(snapshot.store)) {
    if (record?.typeName !== 'shape') continue
    const siblings = byParent.get(record.parentId) ?? []
    siblings.push(record)
    byParent.set(record.parentId, siblings)
  }
  const shapes = []
  const queue = [...(byParent.get(pageId) ?? [])]
  while (queue.length > 0) {
    const shape = queue.shift()
    shapes.push(shape)
    queue.push(...(byParent.get(shape.id) ?? []))
  }
  return shapes
}

function getAssetIdsForShapes(shapes) {
  return new Set(shapes.map(s => s?.props?.assetId).filter(id => typeof id === 'string'))
}

function snapshotForPage(snapshot, page) {
  const pageId = page.id
  const pageShapes = getShapeRecordsForPage(snapshot, pageId)
  const shapeIds = new Set(pageShapes.map(s => s.id))
  const assetIds = getAssetIdsForShapes(pageShapes)
  const store = {}

  for (const record of Object.values(snapshot.store)) {
    if (!record?.id) continue
    if (record.typeName === 'page') { if (record.id === pageId) store[record.id] = record; continue }
    if (record.typeName === 'shape') { if (shapeIds.has(record.id)) store[record.id] = record; continue }
    if (record.typeName === 'asset') { if (assetIds.has(record.id)) store[record.id] = record; continue }
    store[record.id] = record
  }

  return { schema: snapshot.schema, store }
}

function parseDataUrl(src) {
  const match = /^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s.exec(src)
  if (!match) return null
  const mimeType = match[1] || 'application/octet-stream'
  const isBase64 = /^data:[^,]*;base64,/i.test(src)
  const buffer = isBase64 ? Buffer.from(match[2], 'base64') : Buffer.from(decodeURIComponent(match[2]))
  return { buffer, mimeType }
}

function extensionFromMime(mime) {
  const map = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/apng': '.apng', 'image/avif': '.avif' }
  return map[mime] ?? '.bin'
}

function sanitizeFileName(name, fallbackName, mimeType) {
  const rawName = basename(String(name || fallbackName || 'asset'))
  const ext = extname(rawName) || extensionFromMime(mimeType)
  const base = rawName.slice(0, rawName.length - extname(rawName).length).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base || 'asset'}${ext}`
}

function localAssetFilePathFromUrl(src) {
  if (src.startsWith(GLOBAL_ASSETS_ROUTE)) {
    const filePath = resolve(join(CANVAS_DIR, 'assets'), decodeURIComponent(src.slice(GLOBAL_ASSETS_ROUTE.length)))
    return isSafeChildPath(join(CANVAS_DIR, 'assets'), filePath) ? filePath : null
  }
  if (src.startsWith(PAGE_ASSETS_ROUTE)) {
    const parts = src.slice(PAGE_ASSETS_ROUTE.length).split('/')
    const pageDir = decodeURIComponent(parts.shift() ?? '')
    if (!pageDir || parts.length === 0) return null
    const filePath = resolve(join(PAGES_DIR, pageDir, 'assets'), ...parts.map(decodeURIComponent))
    return isSafeChildPath(join(PAGES_DIR, pageDir, 'assets'), filePath) ? filePath : null
  }
  return null
}

async function localizeAsset(asset, pageId) {
  const src = asset?.props?.src
  if (!src || typeof src !== 'string' || /^https?:\/\//.test(src)) return asset
  if (src.startsWith(PAGE_ASSETS_ROUTE) && src.startsWith(`${PAGE_ASSETS_ROUTE}${pageDirName(pageId)}/`)) return asset

  const localized = structuredClone(asset)
  const dataUrl = src.startsWith('data:') ? parseDataUrl(src) : null
  const sourcePath = !dataUrl ? localAssetFilePathFromUrl(src) : null
  if (!dataUrl && !sourcePath) return localized

  const fileName = sanitizeFileName(dataUrl ? null : localized.props.name, sourcePath ? basename(sourcePath) : localized.id.replace(':', '-'), dataUrl?.mimeType ?? localized.props.mimeType)
  const destDir = pageAssetsDir(pageId)
  const destPath = join(destDir, fileName)

  await mkdir(destDir, { recursive: true })
  if (dataUrl) {
    await writeFile(destPath, dataUrl.buffer)
    localized.props.mimeType = localized.props.mimeType ?? dataUrl.mimeType
    localized.props.fileSize = dataUrl.buffer.length
  } else if (resolve(sourcePath) !== resolve(destPath)) {
    const { copyFile } = await import('node:fs/promises')
    await copyFile(sourcePath, destPath)
    localized.props.fileSize = (await stat(destPath)).size
  }

  localized.props.name = fileName
  localized.props.src = pageAssetUrl(pageId, fileName)
  return localized
}

async function readAllPageSnapshots() {
  let entries
  try { entries = await readdir(PAGES_DIR, { withFileTypes: true }) } catch { return [] }

  const snapshots = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const filePath = join(PAGES_DIR, entry.name, CANVAS_FILE_NAME)
    try {
      const snapshot = JSON.parse(await readFile(filePath, 'utf8'))
      if (isSnapshot(snapshot)) snapshots.push({ filePath, snapshot })
    } catch (e) { if (e.code !== 'ENOENT') throw e }
  }
  return snapshots
}

async function loadCanvasSnapshot() {
  const pageSnapshots = await readAllPageSnapshots()
  if (pageSnapshots.length > 0) {
    const mergedStore = {}
    for (const { snapshot } of pageSnapshots) Object.assign(mergedStore, snapshot.store)
    return { snapshot: { schema: pageSnapshots[0].snapshot.schema, store: mergedStore }, storage: 'per-page' }
  }
  // Legacy single file
  try {
    const snapshot = JSON.parse(await readFile(join(CANVAS_DIR, CANVAS_FILE_NAME), 'utf8'))
    return { snapshot, storage: 'legacy-single-file' }
  } catch (e) {
    if (e.code === 'ENOENT') return { snapshot: null, storage: 'empty' }
    throw e
  }
}

async function removeStalePageDirs(currentPageIds) {
  let entries
  try { entries = await readdir(PAGES_DIR, { withFileTypes: true }) } catch { return }
  const currentDirs = new Set([...currentPageIds].map(pageDirName))
  await Promise.all(
    entries
      .filter(e => e.isDirectory() && !currentDirs.has(e.name))
      .map(e => rm(join(PAGES_DIR, e.name), { recursive: true, force: true }))
  )
}

async function saveCanvasSnapshot(snapshot) {
  const pages = getPageRecords(snapshot)
  if (pages.length === 0) {
    await atomicWrite(join(CANVAS_DIR, CANVAS_FILE_NAME), JSON.stringify(snapshot, null, 2))
    return { storage: 'legacy-single-file' }
  }

  const currentPageIds = new Set(pages.map(p => p.id))
  await removeStalePageDirs(currentPageIds)

  for (const page of pages) {
    const pageSnap = snapshotForPage(snapshot, page)
    // Localize data: URLs and cross-page assets
    const entries = await Promise.all(
      Object.entries(pageSnap.store).map(async ([id, record]) => {
        if (record?.typeName !== 'asset') return [id, record]
        return [id, await localizeAsset(record, page.id)]
      })
    )
    pageSnap.store = Object.fromEntries(entries)
    await atomicWrite(pageFilePath(page.id), JSON.stringify(pageSnap, null, 2))
  }

  // Write manifest
  const manifest = {
    version: 1,
    source: 'kai-infinity-canvas',
    pages: pages.map(p => ({ id: p.id, name: p.name, index: p.index, path: relative(CANVAS_DIR, pageFilePath(p.id)) })),
  }
  await atomicWrite(PAGES_MANIFEST, JSON.stringify(manifest, null, 2))

  return { storage: 'per-page' }
}

// ── Static File Serving ───────────────────────────────────────────────

async function serveStatic(req, res, url) {
  let filePath = join(STATIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!filePath.startsWith(STATIC_DIR)) { res.statusCode = 403; res.end('Forbidden'); return }

  try {
    const s = await stat(filePath)
    if (!s.isFile()) { res.statusCode = 404; res.end('Not found'); return }
    res.statusCode = 200
    res.setHeader('content-type', MIME_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream')
    res.setHeader('cache-control', 'no-cache, no-store, must-revalidate')
    createReadStream(filePath).pipe(res)
  } catch (e) {
    if (e.code === 'ENOENT') {
      // SPA fallback
      try {
        const indexPath = join(STATIC_DIR, 'index.html')
        await stat(indexPath)
        res.statusCode = 200
        res.setHeader('content-type', 'text/html')
        createReadStream(indexPath).pipe(res)
      } catch {
        res.statusCode = 404; res.end('Not found')
      }
    } else {
      res.statusCode = 500; res.end(e.message)
    }
  }
}

async function serveCanvasAsset(req, res, url) {
  const filePath = localAssetFilePathFromUrl(url.pathname)
  if (!filePath) { res.statusCode = 403; res.end('Forbidden'); return }
  try {
    const s = await stat(filePath)
    if (!s.isFile()) { res.statusCode = 404; res.end('Not found'); return }
    res.statusCode = 200
    res.setHeader('content-type', MIME_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream')
    res.setHeader('cache-control', 'no-cache')
    createReadStream(filePath).pipe(res)
  } catch (e) {
    if (e.code === 'ENOENT') { res.statusCode = 404; res.end('Not found') }
    else { res.statusCode = 500; res.end(e.message) }
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  lastActivity = Date.now()

  // CORS — allow sandboxed iframes (null origin) to load canvas
  res.setHeader('access-control-allow-origin', '*')
  if (req.method === 'OPTIONS') {
    res.setHeader('access-control-allow-methods', 'GET, PUT, POST, OPTIONS')
    res.setHeader('access-control-allow-headers', 'content-type')
    res.statusCode = 204
    res.end()
    return
  }

  const url = new URL(req.url, 'http://127.0.0.1')

  try {
    // Health check
    if (url.pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok', canvasDir: CANVAS_DIR, projectDir: PROJECT_DIR,
        pid: process.pid, port: PORT, uptime: Math.floor(process.uptime()),
        sseClients: sseClients.size,
      })
      return
    }

    // Canvas API
    if (url.pathname === '/api/canvas') {
      if (req.method === 'GET') {
        const result = await loadCanvasSnapshot()
        sendJson(res, 200, result)
        return
      }
      if (req.method === 'PUT') {
        const body = await readBody(req)
        const snapshot = JSON.parse(body)
        if (!isSnapshot(snapshot)) { sendJson(res, 400, { error: 'Expected a tldraw store snapshot' }); return }
        const result = await saveCanvasSnapshot(snapshot)
        broadcastCanvasChanged('user')
        sendJson(res, 200, { ok: true, ...result })
        return
      }
      res.statusCode = 405; res.setHeader('allow', 'GET, PUT'); res.end()
      return
    }

    // Selection API
    if (url.pathname === '/api/selection') {
      if (req.method === 'GET') {
        try {
          const selection = JSON.parse(await readFile(SELECTION_FILE, 'utf8'))
          sendJson(res, 200, { selection })
        } catch (e) {
          if (e.code === 'ENOENT') sendJson(res, 200, { selection: { selectedShapes: [], updatedAt: null } })
          else throw e
        }
        return
      }
      if (req.method === 'PUT') {
        const body = await readBody(req)
        const selection = JSON.parse(body)
        await atomicWrite(SELECTION_FILE, JSON.stringify(selection, null, 2))
        sendJson(res, 200, { ok: true })
        return
      }
      res.statusCode = 405; res.setHeader('allow', 'GET, PUT'); res.end()
      return
    }

    // View state API
    if (url.pathname === '/api/view-state') {
      if (req.method === 'GET') {
        try {
          const viewState = JSON.parse(await readFile(VIEW_STATE_FILE, 'utf8'))
          sendJson(res, 200, { viewState })
        } catch (e) {
          if (e.code === 'ENOENT') sendJson(res, 200, { viewState: { version: 1, currentPageId: null, camera: { x: 0, y: 0, z: 1 }, updatedAt: null } })
          else throw e
        }
        return
      }
      if (req.method === 'PUT') {
        const body = await readBody(req)
        await atomicWrite(VIEW_STATE_FILE, body)
        sendJson(res, 200, { ok: true })
        return
      }
      res.statusCode = 405; res.setHeader('allow', 'GET, PUT'); res.end()
      return
    }

    // MCP notify
    if (url.pathname === '/api/notify' && req.method === 'POST') {
      broadcastCanvasChanged('mcp')
      sendJson(res, 200, { ok: true })
      return
    }

    // SSE
    if (url.pathname === '/api/canvas-events' && req.method === 'GET') {
      res.statusCode = 200
      res.setHeader('content-type', 'text/event-stream')
      res.setHeader('cache-control', 'no-cache, no-transform')
      res.setHeader('connection', 'keep-alive')
      res.setHeader('x-accel-buffering', 'no')
      res.write(`: connected\n\n`)

      sseClients.add(res)
      lastActivity = Date.now()

      const heartbeat = setInterval(() => {
        if (res.destroyed) { clearInterval(heartbeat); sseClients.delete(res); return }
        res.write(`: heartbeat ${Date.now()}\n\n`)
        lastActivity = Date.now()
      }, 25000)

      req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); lastActivity = Date.now() })
      return
    }

    // Canvas page assets (but NOT /assets/ which serves frontend dist/)
    if (url.pathname.startsWith(PAGE_ASSETS_ROUTE)) {
      await serveCanvasAsset(req, res, url)
      return
    }

    // Static files (frontend dist/ — includes /assets/ for JS/CSS bundles)
    await serveStatic(req, res, url)
  } catch (error) {
    if (!res.headersSent) { res.statusCode = 500 }
    res.end(JSON.stringify({ error: error.message }))
  }
})

// ── Idle timeout disabled — server stays alive for the session ───────
// Previous: 30min idle auto-shutdown caused mid-session disconnects.
// The smart launcher (scripts/start-canvas.mjs) handles process lifecycle.

// ── Start ─────────────────────────────────────────────────────────────

server.listen(PORT, '127.0.0.1', async () => {
  await writePidFile()
  console.log(`kai-canvas server: http://127.0.0.1:${PORT}`)
  console.log(`Canvas data: ${CANVAS_DIR}`)
  console.log(`Project dir: ${PROJECT_DIR}`)
})

process.on('SIGTERM', async () => { await removePidFile(); server.close(); process.exit(0) })
process.on('SIGINT', async () => { await removePidFile(); server.close(); process.exit(0) })
