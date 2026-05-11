import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleValidateIR } from './tools/validate-ir.js';
import { handleListThemes } from './tools/list-themes.js';
import { handleRenderReport } from './tools/render-report.js';
import { handlePreviewSection } from './tools/preview-section.js';

const server = new McpServer(
  { name: 'report-renderer', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

// Tool: validate_ir
server.tool(
  'validate_ir',
  'Validate a .report.md IR file for syntax and semantic correctness',
  { ir_content: z.string().describe('Complete .report.md IR content') },
  async ({ ir_content }) => {
    const result = handleValidateIR({ ir_content });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// Tool: list_themes
server.tool(
  'list_themes',
  'List all available report themes with descriptions',
  {},
  async () => {
    const result = handleListThemes();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// Tool: render_report
server.tool(
  'render_report',
  'Render a .report.md IR into a complete HTML file',
  {
    ir_content: z.string().describe('Complete .report.md IR content'),
    output_path: z.string().optional().describe('Output HTML file path'),
    theme_override: z.string().optional().describe('Override theme name'),
    bundle: z.boolean().optional().describe('Inline CDN resources'),
  },
  async ({ ir_content, output_path, theme_override, bundle }) => {
    const result = await handleRenderReport({ ir_content, output_path, theme_override, bundle });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// Tool: preview_section
server.tool(
  'preview_section',
  'Render a single section IR fragment into HTML',
  {
    section_ir: z.string().describe('Single section IR content'),
    theme: z.string().optional().describe('Theme name'),
    lang: z.string().optional().describe('Language (zh/en)'),
  },
  async ({ section_ir, theme, lang }) => {
    const result = handlePreviewSection({ section_ir, theme, lang });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
