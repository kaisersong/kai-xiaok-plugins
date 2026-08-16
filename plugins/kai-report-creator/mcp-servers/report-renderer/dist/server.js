import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { handleValidateIR } from './tools/validate-ir.js';
import { handleListThemes } from './tools/list-themes.js';
import { handleRenderReport } from './tools/render-report.js';
import { handlePreviewSection } from './tools/preview-section.js';
export function buildServer() {
    const server = new McpServer({ name: 'report-renderer', version: '2.2.0' }, { capabilities: { tools: {} } });
    server.registerTool('validate_ir', {
        description: 'Validate a .report.md IR file for syntax and semantic correctness',
        inputSchema: z.object({
            ir_content: z.string().describe('Complete .report.md IR content'),
        }),
    }, async ({ ir_content }) => {
        const result = handleValidateIR({ ir_content });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    server.registerTool('list_themes', {
        description: 'List all available report themes with descriptions',
        inputSchema: z.object({}),
    }, async () => {
        const result = handleListThemes();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    server.registerTool('render_report', {
        description: 'Render a .report.md IR into a complete HTML file',
        inputSchema: z.object({
            ir_content: z.string().describe('Complete .report.md IR content'),
            output_path: z.string().optional().describe('Output HTML file path'),
            theme_override: z.string().optional().describe('Override theme name'),
            bundle: z.boolean().optional().describe('Inline CDN resources'),
        }),
    }, async ({ ir_content, output_path, theme_override, bundle }) => {
        const result = await handleRenderReport({ ir_content, output_path, theme_override, bundle });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    server.registerTool('preview_section', {
        description: 'Render a single section IR fragment into HTML',
        inputSchema: z.object({
            section_ir: z.string().describe('Single section IR content'),
            theme: z.string().optional().describe('Theme name'),
            lang: z.string().optional().describe('Language (zh/en)'),
        }),
    }, async ({ section_ir, theme, lang }) => {
        const result = handlePreviewSection({ section_ir, theme, lang });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    return server;
}
serveStdio(() => buildServer());
//# sourceMappingURL=server.js.map