import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..')
const outputDir = await mkdtemp(resolve(tmpdir(), 'plugin-sync-smoke-'))
try {
for (const kind of ['slide', 'report']) {
 const cwd=resolve(root, `plugins/kai-${kind}-creator`)
 const client=new Client({name:'source-sync-smoke',version:'1'}, {versionNegotiation:{mode:{pin:'2026-07-28'}}})
 const command=kind==='slide'?process.env.MCP_TEST_PYTHON:process.execPath
 const path=kind==='slide'?'mcp-servers/slide-renderer/server.py':'mcp-servers/report-renderer/dist/server.bundle.js'
 try {
  await client.connect(new StdioClientTransport({command,args:[resolve(cwd,path)],cwd,stderr:'pipe'}))
  const output_path=resolve(outputDir, `sync-${kind}-smoke.html`)
  let args, name
  if(kind==='slide') {
   const context=await client.callTool({name:'get_model_context',arguments:{preset:'Blue Sky'}})
   assert.ok(context.content.some(c=>c.type==='text' && c.text.includes('supporting_facts')))
   const brief_json=await readFile(resolve(cwd,'mcp-servers/slide-renderer/tests/fixtures/valid-brief.json'),'utf8')
   name='render_slide'; args={brief_json,output_path,requested_preset:'data-story'}
  } else {
   name='render_report';args={ir_content:await readFile(resolve(cwd,'mcp-servers/report-renderer/tests/fixtures/valid-mixed.report.md'),'utf8'),output_path}
  }
  const result=await client.callTool({name,arguments:args},{timeout:15000})
  assert.ok(!result.isError,JSON.stringify(result))
  const html=await readFile(output_path,'utf8')
  assert.ok(html.includes(kind==='slide'?'data-validate-strict="pass"':'data-template="kai-report-creator"'))
  console.log(`${kind}: modern stdio initialized, contract/tool render completed, ${Buffer.byteLength(html)} HTML bytes`)
 } finally { await client.close() }
}

} finally { await rm(outputDir, { recursive:true, force:true }) }
