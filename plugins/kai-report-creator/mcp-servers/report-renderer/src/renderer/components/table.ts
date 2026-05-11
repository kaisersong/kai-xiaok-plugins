import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
import { escHtmlPreserveInline } from '../escape.js';

/**
 * Render a :::table block into HTML.
 * Body is a Markdown table.
 */
export function renderTable(block: IRBlock, options: RenderOptions): string {
  const lines = block.body.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return '<!-- empty table -->';

  // Parse header
  const headers = parseCells(lines[0]!);
  // Skip separator line
  const dataLines = lines.slice(2);

  const headerHtml = headers.map(h => `<th>${escHtmlPreserveInline(h)}</th>`).join('');
  const rowsHtml = dataLines.map(line => {
    const cells = parseCells(line);
    return `      <tr>${cells.map(c => `<td>${escHtmlPreserveInline(c)}</td>`).join('')}</tr>`;
  }).join('\n');

  const animClass = options.animations ? ' fade-in-up' : '';

  return `    <div class="table-wrapper${animClass}">
      <table class="report-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>
${rowsHtml}
        </tbody>
      </table>
    </div>`;
}

function parseCells(line: string): string[] {
  return line.split('|')
    .map(c => c.trim())
    .filter(c => c && !/^[-:]+$/.test(c));
}
