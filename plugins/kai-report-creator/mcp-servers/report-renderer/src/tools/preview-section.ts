import { parseBlocks, type IRBlock } from '../parser/ir-parser.js';
import { loadTheme, assembleCSS } from '../themes/loader.js';
import { renderChart } from '../renderer/components/chart.js';
import { renderTimeline } from '../renderer/components/timeline.js';
import { renderDiagram } from '../renderer/components/diagram.js';
import { renderCode } from '../renderer/components/code.js';
import { renderImage } from '../renderer/components/image.js';
import { renderKpi } from '../renderer/components/kpi.js';
import { renderTable } from '../renderer/components/table.js';
import { renderCallout } from '../renderer/components/callout.js';
import { renderList } from '../renderer/components/list.js';
import type { RenderOptions } from '../renderer/types.js';

export interface PreviewSectionInput {
  section_ir: string;
  theme?: string;
  lang?: string;
}

export interface PreviewSectionResult {
  html_fragment: string;
  validation_errors: string[];
}

export function handlePreviewSection(input: PreviewSectionInput): PreviewSectionResult {
  const errors: string[] = [];
  const themeName = input.theme ?? 'corporate-blue';
  const lang = input.lang ?? 'zh';

  const blocks = parseBlocks(input.section_ir);
  if (blocks.length === 0) {
    errors.push('No :::blocks found in section IR');
    return { html_fragment: '', validation_errors: errors };
  }

  const renderOpts: RenderOptions = { theme: themeName, lang, animations: true };
  const fragments: string[] = [];

  for (const block of blocks) {
    const html = renderBlockForPreview(block, renderOpts);
    if (html) fragments.push(html);
  }

  // Wrap with minimal theme CSS
  const theme = loadTheme(themeName);
  const css = assembleCSS(theme);
  const wrapped = `<style>${css}</style>\n<div class="report-wrapper">\n${fragments.join('\n')}\n</div>`;

  return { html_fragment: wrapped, validation_errors: errors };
}

function renderBlockForPreview(block: IRBlock, options: RenderOptions): string {
  switch (block.tag) {
    case 'kpi': return renderKpi(block, options);
    case 'table': return renderTable(block, options);
    case 'callout': return renderCallout(block, options);
    case 'list': return renderList(block, options);
    case 'chart': return renderChart(block, options);
    case 'timeline': return renderTimeline(block, options);
    case 'diagram': return renderDiagram(block, options);
    case 'code': return renderCode(block, options);
    case 'image': return renderImage(block, options);
    default: return `<!-- unknown: ${block.tag} -->`;
  }
}
