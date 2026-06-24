import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PLUGIN_ROOT = resolve(__dirname, '..')
const MCP_SERVER = join(PLUGIN_ROOT, 'mcp-servers', 'canvas-server', 'server.mjs')
const TEST_DIR = join(process.env.TMPDIR || '/tmp', `kai-canvas-test-${Date.now()}`)

function callMCP(messages) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('node', [MCP_SERVER], { stdio: ['pipe', 'pipe', 'pipe'] })
    const responses = []

    const dataHandler = (d) => {
      const lines = d.toString().trim().split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          responses.push(msg)
        } catch {}
      }
    }
    child.stdout.on('data', dataHandler)
    child.stderr.on('data', () => {}) // swallow stderr

    let msgIndex = 0
    function sendNext() {
      if (msgIndex >= messages.length) {
        // Wait a bit for final responses then kill
        setTimeout(() => { child.kill(); resolvePromise(responses) }, 500)
        return
      }
      child.stdin.write(JSON.stringify(messages[msgIndex]) + '\n')
      msgIndex++
      setTimeout(sendNext, 200)
    }
    sendNext()

    child.on('error', reject)
    setTimeout(() => { try { child.kill() } catch {}; resolvePromise(responses) }, 8000)
  })
}

describe('MCP Server', () => {
  beforeEach(async () => {
    await mkdir(join(TEST_DIR, 'canvas'), { recursive: true })
  })

  afterEach(async () => {
    try { await rm(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  it('should respond to initialize', async () => {
    const responses = await callMCP([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    ])
    const init = responses.find(r => r.id === 1)
    assert.ok(init, 'should have a response with id=1')
    assert.ok(init?.result?.serverInfo, 'should have serverInfo')
    assert.equal(init.result.serverInfo.name, 'kai-canvas-mcp')
  })

  it('should list 2 tools', async () => {
    const responses = await callMCP([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ])
    const list = responses.find(r => r.id === 2)
    assert.ok(list?.result?.tools, 'should have tools array')
    const toolNames = list.result.tools.map(t => t.name)
    assert.ok(toolNames.includes('kai_canvas_get_selection'))
    assert.ok(toolNames.includes('kai_canvas_insert_image'))
  })

  it('should return empty selection for new project', async () => {
    const responses = await callMCP([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: {
        name: 'kai_canvas_get_selection',
        arguments: { projectDir: TEST_DIR },
      }},
    ])
    const result = responses.find(r => r.id === 2)
    assert.ok(result?.result?.structuredContent?.selection, 'should have selection')
    assert.equal(result.result.structuredContent.selection.selectedShapes.length, 0)
  })
})

describe('Storage', () => {
  it('should create per-page directory structure', async () => {
    const pageDir = join(TEST_DIR, 'canvas', 'pages', 'test')
    await mkdir(pageDir, { recursive: true })
    const snapshot = {
      schema: { schemaVersion: 3, storeVersion: 4, recordVersions: {} },
      store: { 'page:test': { id: 'page:test', typeName: 'page', index: 'a1', name: 'Test', meta: {} } },
    }
    await writeFile(join(pageDir, 'canvas.json'), JSON.stringify(snapshot, null, 2))
    const s = await stat(join(pageDir, 'canvas.json'))
    assert.ok(s.isFile())
  })
})
