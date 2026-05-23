import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument, type IRDocument, type IRBlock } from '../parser/ir-parser.js';
import { escHtml, escHtmlPreserveInline, escHtmlText } from './escape.js';
import { loadTheme, assembleCSS } from '../themes/loader.js';
import { buildHtmlShell, type ShellOptions } from './shell.js';
import { renderKpi } from './components/kpi.js';
import { renderTable } from './components/table.js';
import { renderCallout } from './components/callout.js';
import { renderList } from './components/list.js';
import { renderChart } from './components/chart.js';
import { renderTimeline } from './components/timeline.js';
import { renderDiagram } from './components/diagram.js';
import { renderCode } from './components/code.js';
import { renderImage } from './components/image.js';
import type { RenderOptions } from './types.js';

export interface RenderResult {
  success: boolean;
  outputPath: string;
  html: string;
  validation: { l0: boolean; l1: boolean; l2: boolean; l3: boolean };
  warnings: string[];
  stats: { sections: number; components: number; cssBytes: number; htmlBytes: number };
}

export interface RenderInput {
  irContent: string;
  outputPath?: string;
  themeOverride?: string;
  bundle?: boolean;
}

export function renderReport(input: RenderInput): RenderResult {
  const warnings: string[] = [];
  const doc = parseDocument(input.irContent);

  if (doc.frontmatterWarnings.length > 0) {
    warnings.push(...doc.frontmatterWarnings);
  }

  const themeName = input.themeOverride ?? doc.frontmatter.theme;
  const theme = loadTheme(themeName);
  const css = assembleCSS(theme, doc.frontmatter.theme_overrides);
  const lang = doc.frontmatter.lang ?? 'zh';
  const animations = doc.frontmatter.animations !== false;
  const toc = doc.frontmatter.toc !== false;

  const renderOpts: RenderOptions = { theme: themeName, lang, animations };

  // Detect CDN needs
  const needsEcharts = doc.blocks.some(b => b.tag === 'chart');
  const needsHighlightjs = doc.blocks.some(b => b.tag === 'code');

  // Render sections
  const bodyParts: string[] = [];
  for (const section of doc.sections) {
    const slug = section.slug;
    const summary = (section.content.split('\n').find(l => {
      const t = l.trim();
      return t && !t.startsWith(':::') && !t.startsWith('<');
    })?.trim() ?? '').replace(/<[^>]+>/g, '');

    bodyParts.push(`        <section data-section="${escHtml(section.heading)}" data-summary="${escHtml(summary)}" id="section-${slug}">`);
    bodyParts.push(`          <h${section.level} id="section-${slug}">${escHtmlText(section.heading)}</h${section.level}>`);

    // Render content in document order: prose and blocks interleaved
    const lines = section.content.split('\n');
    let blockQueue = [...section.blocks]; // blocks to render in order
    let inBlock = false;
    let proseBuffer: string[] = [];

    const flushProse = () => {
      if (proseBuffer.length === 0) return;
      const text = proseBuffer.join(' ').trim();
      if (text) {
        // Check if the prose is a standalone HTML block element (div, p with class, etc.)
        const isHtmlBlock = /^<(div|p)\s/.test(text) && text.endsWith('>');
        if (isHtmlBlock) {
          if (animations) {
            // Merge animation class into existing class attr, or add new one
            if (/class="/.test(text)) {
              bodyParts.push(`          ${text.replace(/class="/, 'class="fade-in-up ')}`);
            } else {
              bodyParts.push(`          ${text.replace(/^<(\w+)/, '<$1 class="fade-in-up"')}`);
            }
          } else {
            bodyParts.push(`          ${text}`);
          }
        } else {
          const proseClass = animations ? ' class="fade-in-up"' : '';
          bodyParts.push(`          <p${proseClass}>${renderInlineMarkdown(text)}</p>`);
        }
      }
      proseBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      // Skip section headings (already rendered above)
      if (trimmed.startsWith('##')) continue;

      // Block open
      if (trimmed.match(/^:::\w/)) {
        flushProse();
        inBlock = true;
        continue;
      }

      // Block close — render the next queued block
      if (trimmed === ':::') {
        inBlock = false;
        if (blockQueue.length > 0) {
          const block = blockQueue.shift()!;
          const html = renderBlock(block, renderOpts);
          if (html) bodyParts.push(html);
        }
        continue;
      }

      // Inside a block — skip (block renderer handles it)
      if (inBlock) continue;

      // Horizontal rule
      if (trimmed === '---') {
        flushProse();
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushProse();
        const headingLevel = Math.min(section.level + 1, 6);
        const headingText = headingMatch[2]!.trim();
        bodyParts.push(`          <h${headingLevel}>${renderInlineMarkdown(headingText)}</h${headingLevel}>`);
        continue;
      }

      if (isMarkdownTableStart(lines, i)) {
        flushProse();
        const tableLines: string[] = [];
        while (i < lines.length && isMarkdownTableLine(lines[i]!)) {
          tableLines.push(renderInlineMarkdown(lines[i]!.trim()));
          i += 1;
        }
        i -= 1;
        const html = renderBlock(markdownBlock('table', tableLines.join('\n')), renderOpts);
        if (html) bodyParts.push(html);
        continue;
      }

      const listStyle = markdownListStyle(trimmed);
      if (listStyle) {
        flushProse();
        const listLines: string[] = [];
        while (i < lines.length && markdownListStyle(lines[i]!.trim()) === listStyle) {
          listLines.push(renderInlineMarkdown(lines[i]!.trim()));
          i += 1;
        }
        i -= 1;
        const html = renderBlock(markdownBlock('list', listLines.join('\n'), { style: listStyle }), renderOpts);
        if (html) bodyParts.push(html);
        continue;
      }

      // Blank line — flush current prose paragraph
      if (!trimmed) {
        flushProse();
        continue;
      }

      // Prose line — preserve inline HTML (badges, highlights, etc.)
      proseBuffer.push(trimmed);
    }

    flushProse();
    bodyParts.push(`        </section>`);
  }

  // Build report-summary JSON
  const reportSummary = {
    title: doc.frontmatter.title,
    theme: themeName,
    lang,
    date: doc.frontmatter.date ?? '',
    abstract: doc.frontmatter.abstract ?? '',
    poster_title: doc.frontmatter.poster_title ?? '',
    poster_subtitle: doc.frontmatter.poster_subtitle ?? '',
    poster_note: doc.frontmatter.poster_note ?? '',
    kpis: extractKpis(doc),
    sections: doc.sections.map(s => ({ title: s.heading, slug: s.slug })),
  };

  // Compute IR hash
  const irHash = createHash('sha256').update(input.irContent).digest('hex').slice(0, 16);

  // TOC items
  const tocItems = doc.sections.map(s => ({
    slug: s.slug,
    text: s.heading,
    level: s.level,
  }));

  const shellOpts: ShellOptions = {
    title: doc.frontmatter.title || 'Report',
    theme: themeName,
    lang,
    css,
    needsEcharts,
    needsHighlightjs,
    toc,
    animations,
    irHash,
    reportSummaryJson: JSON.stringify(reportSummary),
    bodyContent: bodyParts.join('\n'),
    tocItems,
    author: doc.frontmatter.author ?? '',
    date: doc.frontmatter.date ?? '',
    abstract: doc.frontmatter.abstract ?? '',
    version: '2.0.0',
  };

  const html = buildHtmlShell(shellOpts);

  // Validate output
  const validation = validateOutput(html);
  if (!validation.l0) warnings.push('L0 validation failed: possible ::: leakage or missing ir-hash');
  if (!validation.l1) warnings.push('L1 validation failed: shell structure incomplete');
  if (!validation.l2) warnings.push('L2 validation failed: missing required IDs');
  if (!validation.l3) warnings.push(`L3 validation failed: ${validation.qualityFindings.join('; ')}`);

  // Write file
  const outputPath = input.outputPath ?? `report-${doc.frontmatter.date || 'output'}.html`;
  try {
    writeFileSync(outputPath, html, 'utf-8');
  } catch (e) {
    warnings.push(`Failed to write file: ${(e as Error).message}`);
  }

  return {
    success: validation.l0 && validation.l1 && validation.l2 && validation.l3,
    outputPath,
    html,
    validation: { l0: validation.l0, l1: validation.l1, l2: validation.l2, l3: validation.l3 },
    warnings,
    stats: {
      sections: doc.sections.length,
      components: doc.blocks.length,
      cssBytes: css.length,
      htmlBytes: html.length,
    },
  };
}

function markdownBlock(tag: string, body: string, params: Record<string, string> = {}): IRBlock {
  return { tag, body, params, lineStart: 0, lineEnd: 0 };
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  return isMarkdownTableLine(lines[index] || '') && isMarkdownTableSeparator(lines[index + 1] || '');
}

function isMarkdownTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3;
}

function isMarkdownTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed);
}

function markdownListStyle(line: string): 'ordered' | 'unordered' | null {
  if (/^[-*]\s+/.test(line)) return 'unordered';
  if (/^\d+\.\s+/.test(line)) return 'ordered';
  return null;
}

function renderInlineMarkdown(value: string): string {
  const escaped = escHtmlPreserveInline(value);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

function renderBlock(block: IRBlock, options: RenderOptions): string {
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
    default: return `<!-- unknown component: ${block.tag} -->`;
  }
}

// HTML output validation
interface ValidationResult { l0: boolean; l1: boolean; l2: boolean; l3: boolean; qualityFindings: string[] }

function validateOutput(html: string): ValidationResult {
  // L0: No ::: leakage, ir-hash exists
  const l0 = !html.includes(':::') || html.indexOf(':::') === html.indexOf('<!');
  const hasIrHash = /meta\s+name="ir-hash"\s+content="[^"]+"/i.test(html);
  const l0Pass = !(/^:::/m.test(html.replace(/<[^>]+>/g, ''))) && hasIrHash;

  // L1: Shell structure
  const l1 = html.includes('data-template="kai-report-creator"')
    && html.includes('<script')
    && html.includes('report-wrapper');

  // L2: Required IDs
  const requiredIds = [
    'toc-toggle-btn', 'toc-sidebar', 'card-mode-btn',
    'sc-overlay', 'sc-card', 'sc-close',
    'edit-hotzone', 'edit-toggle',
    'export-btn', 'export-menu',
    'export-print', 'export-png-desktop', 'export-png-mobile',
    'export-im-share', 'report-summary',
  ];
  const l2 = requiredIds.every(id => html.includes(`id="${id}"`));
  const qualityFindings = validateKpiValues(html);
  const l3 = qualityFindings.length === 0;

  return { l0: l0Pass, l1, l2, l3, qualityFindings };
}

const PLACEHOLDER_RE = /\[(?:INSERT VALUE|数据待填写)\]/;

function hasRealNumber(value: string): boolean {
  return /\d/.test(value) && !PLACEHOLDER_RE.test(value);
}

function stripTags(fragment: string): string {
  return fragment.replace(/<[^>]+>/g, '').trim();
}

function validateKpiValues(html: string): string[] {
  const findings: string[] = [];
  const kpiValuePattern = /<div\b[^>]*class="[^"]*\bkpi-value\b[^"]*"[^>]*>(.*?)<\/div>/gs;
  for (const match of html.matchAll(kpiValuePattern)) {
    const value = stripTags(match[1] ?? '');
    if (!hasRealNumber(value)) findings.push(`invalid KPI value "${value}"`);
  }

  const summaryMatch = html.match(/<script\b[^>]*id="report-summary"[^>]*>\s*([\s\S]*?)\s*<\/script>/);
  if (!summaryMatch) {
    findings.push('missing report-summary JSON');
    return findings;
  }

  try {
    const summary = JSON.parse(summaryMatch[1] ?? '{}') as { kpis?: Array<{ value?: unknown }> };
    if (Array.isArray(summary.kpis)) {
      for (const item of summary.kpis) {
        const value = String(item?.value ?? '').trim();
        if (value && !hasRealNumber(value)) findings.push(`invalid summary KPI value "${value}"`);
      }
    }
  } catch {
    findings.push('invalid report-summary JSON');
  }

  return findings;
}

function extractKpis(doc: IRDocument): Array<{ label: string; value: string; trend: string }> {
  const kpis: Array<{ label: string; value: string; trend: string }> = [];
  for (const block of doc.blocks) {
    if (block.tag !== 'kpi') continue;
    const lines = block.body.split('\n');
    let current: { label?: string; value?: string; trend?: string } | null = null;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('- label:') || t.startsWith('-label:')) {
        if (current && current.label) kpis.push({ label: current.label, value: current.value ?? '', trend: current.trend ?? '' });
        const m = t.match(/label:\s*(.+)/);
        current = { label: m ? m[1]!.trim().replace(/^['"]|['"]$/g, '') : '' };
      } else if (current) {
        if (t.startsWith('value:')) { const m = t.match(/value:\s*(.+)/); if (m) current.value = m[1]!.trim().replace(/^['"]|['"]$/g, ''); }
        if (t.startsWith('trend:')) { const m = t.match(/trend:\s*(.+)/); if (m) current.trend = m[1]!.trim().replace(/^['"]|['"]$/g, ''); }
      }
    }
    if (current && current.label) kpis.push({ label: current.label, value: current.value ?? '', trend: current.trend ?? '' });
  }
  return kpis.slice(0, 6);
}
