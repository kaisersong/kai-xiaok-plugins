import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const python = process.env.MCP_TEST_PYTHON || 'python3'
const cases = [
  ['kai-report-creator', process.execPath, 'mcp-servers/report-renderer/dist/server.bundle.js', 'list_themes', {}, 4],
  ['kai-slide-creator', python, 'mcp-servers/slide-renderer/server.py', 'list_presets', {}, 4],
  ['kai-meeting-assistant', python, 'mcp-servers/meeting-transcriber/server.py', 'transcribe_file_tool', { audio_path: resolve(root, 'missing-audio.wav') }, 1],
  ['kai-infinity-canvas', process.execPath, 'mcp-servers/canvas-server/dist/server.bundle.js', 'kai_canvas_get_selection', { projectDir: root }, 4],
]

for (const [plugin, command, script, tool, args, count] of cases) {
  test(`${plugin}: real modern stdio, subscriptions ACK, schemas and calls`, { timeout: 20000 }, async () => {
    const cwd = resolve(root, 'plugins', plugin)
    const client = new Client({ name: 'plugin-event-test', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
    const transport = new StdioClientTransport({ command, args: [resolve(cwd, script)], cwd, stderr: 'pipe' })
    let stderr = ''
    transport.stderr?.on('data', data => { stderr += data })
    try {
      await client.connect(transport, { timeout: 10000 })
      assert.equal(client.getProtocolEra(), 'modern')
      const tools = (await client.listTools()).tools
      assert.equal(tools.length, count)
      assert.ok(tools.every(tool => !('ctx' in (tool.inputSchema.properties || {}))))
      const subscription = await client.listen({ toolsListChanged: true }, { timeout: 2000 })
      assert.equal(subscription.honoredFilter.toolsListChanged, true)
      const result = await client.callTool({ name: tool, arguments: args }, { timeout: 5000 })
      assert.ok(result.content.length)
      await subscription.close()
      assert.equal(await subscription.closed, 'local')
    } catch (error) { error.message += `\n${stderr}`; throw error }
    finally { await client.close() }
  })
}

for (const plugin of ['kai-report-creator', 'kai-slide-creator', 'kai-infinity-canvas', 'kai-meeting-assistant']) {
  test(`${plugin}: opt-in progress on the real production tool`, { timeout: 20000 }, async () => {
    const entry = cases.find(row => row[0] === plugin)
    const cwd = resolve(root, 'plugins', plugin)
    const client = new Client({ name: 'progress-test', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
    try {
      await client.connect(new StdioClientTransport({ command: entry[1], args: [resolve(cwd, entry[2])], cwd, stderr: 'pipe' }))
      const progress = []
      const args = plugin === 'kai-report-creator'
        ? { ir_content: await readFile(resolve(cwd, 'mcp-servers/report-renderer/tests/fixtures/valid-mixed.report.md'), 'utf8') }
        : plugin === 'kai-slide-creator' ? { brief_json: '{' }
        : plugin === 'kai-infinity-canvas' ? { imagePath: resolve(root, 'missing-image.png'), projectDir: root }
        : { audio_path: resolve(root, 'missing-audio.wav') }
      const name = plugin === 'kai-report-creator' ? 'render_report' : plugin === 'kai-slide-creator' ? 'render_slide' : plugin === 'kai-infinity-canvas' ? 'kai_canvas_insert_image' : 'transcribe_file_tool'
      await client.callTool({ name, arguments: args }, { onprogress: value => progress.push(value.progress), timeout: 5000 })
      await new Promise(resolve => setTimeout(resolve, 50))
      assert.ok(progress.length >= 1, 'no progress from production handler')
      assert.ok(progress.every((value, index) => index === 0 || value > progress[index - 1]))
    } finally { await client.close() }
  })
}

test('canvas bundle supports a real legacy client without frontend dependencies', { timeout: 10000 }, async () => {
  const cwd = resolve(root, 'plugins/kai-infinity-canvas')
  const client = new Client({ name: 'legacy', version: '1' }, { versionNegotiation: { mode: 'legacy' } })
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(cwd, 'mcp-servers/canvas-server/dist/server.bundle.js')], cwd, stderr: 'pipe' }))
    assert.equal(client.getProtocolEra(), 'legacy')
    assert.equal((await client.listTools()).tools.length, 4)
    const result = await client.callTool({ name: 'kai_canvas_get_selection', arguments: { projectDir: root } })
    assert.deepEqual(result.structuredContent.selection.selectedShapes, [])
  } finally { await client.close() }
})
