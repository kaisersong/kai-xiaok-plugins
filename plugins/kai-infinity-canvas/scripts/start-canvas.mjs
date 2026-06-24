#!/usr/bin/env node
/**
 * Canvas server launcher for xiaok desktop.
 *
 * Session isolation:
 * - Each session gets its own canvas directory: ~/.xiaok/canvas/sessions/<sessionId>/
 * - Same session reopening → reuse existing server or restart with same data
 * - --list shows all saved canvases
 * - --resume <id> opens a specific historical canvas
 *
 * Usage:
 *   node start-canvas.mjs                    # new or reuse current session
 *   node start-canvas.mjs --list             # list all saved canvases
 *   node start-canvas.mjs --resume <id>      # resume a historical canvas
 *
 * Env: XIAOK_CODE_SESSION_ID (auto-set by desktop)
 */

import { spawn, execSync } from 'node:child_process'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { accessSync, readFileSync, unlinkSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pluginRoot = resolve(__dirname, '..')
const PORT = 43217
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`

const staticDir = join(pluginRoot, 'dist')
const canvasRoot = resolve(join(homedir(), '.xiaok', 'canvas'))
const sessionsDir = join(canvasRoot, 'sessions')

// Parse args
const args = process.argv.slice(2)
const sessionId = process.env.XIAOK_CODE_SESSION_ID || 'default'
const resumeId = args.includes('--resume') ? args[args.indexOf('--resume') + 1] : null
const listMode = args.includes('--list')

// ── Check dist ────────────────────────────────────────────────────────

try {
  accessSync(join(staticDir, 'index.html'))
} catch {
  console.error('Canvas frontend not built. Run: npm install && npm run build')
  process.exit(1)
}

// ── List mode ─────────────────────────────────────────────────────────

if (listMode) {
  try {
    const dirs = readdirSync(sessionsDir)
    const canvases = dirs.map(id => {
      const dir = join(sessionsDir, id)
      const metaFile = join(dir, '.canvas-meta.json')
      let meta = {}
      try { meta = JSON.parse(readFileSync(metaFile, 'utf8')) } catch {}
      return {
        id,
        title: meta.title || id,
        createdAt: meta.createdAt || '',
        updatedAt: statSync(dir).mtime.toISOString(),
        shapes: meta.shapeCount || 0,
      }
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    console.log(JSON.stringify(canvases, null, 2))
  } catch {
    console.log('[]')
  }
  process.exit(0)
}

// ── Determine canvas data dir ─────────────────────────────────────────

// Resume: use specified session id. Otherwise: use current session id.
const effectiveSessionId = resumeId || sessionId
const canvasDataDir = join(sessionsDir, effectiveSessionId)

// Ensure session dir and meta exist
try {
  mkdirSync(canvasDataDir, { recursive: true })
  const metaFile = join(canvasDataDir, '.canvas-meta.json')
  try {
    accessSync(metaFile)
  } catch {
    writeFileSync(metaFile, JSON.stringify({
      sessionId: effectiveSessionId,
      title: `Canvas ${effectiveSessionId.slice(-6)}`,
      createdAt: new Date().toISOString(),
    }, null, 2))
  }
} catch {}

// ── Process management ────────────────────────────────────────────────

function pidFilePath() {
  return join(tmpdir(), `kai-canvas-${PORT}.pid`)
}

function readPidFile() {
  try {
    return JSON.parse(readFileSync(pidFilePath(), 'utf8'))
  } catch {
    return null
  }
}

function isProcessAlive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

function killPid(pid) {
  try { process.kill(pid, 'SIGTERM') } catch {}
}

async function checkHealth() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function waitForHealth(maxWait = 5000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    const h = await checkHealth()
    if (h && h.status === 'ok') return h
    await sleep(300)
  }
  return null
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  // Check if server is already running for THIS session
  const health = await checkHealth()

  if (health && health.status === 'ok') {
    const servingDir = resolve(health.projectDir || '')
    const wantDir = resolve(canvasDataDir)

    if (servingDir === wantDir) {
      console.log(`reuse:${PORT}:${effectiveSessionId}`)
      return
    }

    // Different session — kill old, start new
    const pid = health.pid
    if (pid && isProcessAlive(pid)) {
      killPid(pid)
      await sleep(800)
    }
  }

  // Clean stale PID file
  const pidInfo = readPidFile()
  if (pidInfo?.pid && !isProcessAlive(pidInfo.pid)) {
    try { unlinkSync(pidFilePath()) } catch {}
  }

  // Kill anything on the port
  try {
    const pids = execSync(`lsof -ti:${PORT} 2>/dev/null || true`, { encoding: 'utf8' }).trim()
    if (pids) {
      for (const pid of pids.split('\n').filter(Boolean)) {
        try { process.kill(parseInt(pid), 'SIGTERM') } catch {}
      }
      await sleep(500)
    }
  } catch {}

  // Start server
  const env = {
    ...process.env,
    KAI_CANVAS_PROJECT_DIR: canvasDataDir,
    KAI_CANVAS_STATIC_DIR: staticDir,
    KAI_CANVAS_PORT: String(PORT),
  }

  const child = spawn('node', [join(pluginRoot, 'server', 'index.mjs')], {
    env,
    stdio: 'ignore',
    detached: true,
  })
  child.unref()

  const result = await waitForHealth(5000)
  if (result) {
    console.log(`started:${PORT}:${effectiveSessionId}`)
  } else {
    console.error('FAILED: canvas server did not become healthy within 5s')
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Launcher error:', e.message)
  process.exit(1)
})
