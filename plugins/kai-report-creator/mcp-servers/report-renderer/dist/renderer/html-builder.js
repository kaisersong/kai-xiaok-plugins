import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { parseDocument } from '../parser/ir-parser.js';
import { escHtml, escHtmlPreserveInline, escHtmlText } from './escape.js';
import { loadTheme, assembleCSS } from '../themes/loader.js';
import { buildHtmlShell } from './shell.js';
import { isAnimatedMode, shouldRenderCover, splitAccentPhrase, parseCoverBody, normaliseCover, renderCoverSection, } from './cover.js';
import { extractKpis, validateAnimatedOutput, } from './animated/common.js';
import { buildScrollytelling } from './animated/scrollytelling.js';
import { buildIridescence } from './animated/iridescence.js';
import { renderKpi } from './components/kpi.js';
import { renderTable } from './components/table.js';
import { renderCallout } from './components/callout.js';
import { renderList } from './components/list.js';
import { renderChart } from './components/chart.js';
import { renderTimeline } from './components/timeline.js';
import { renderDiagram } from './components/diagram.js';
import { renderCode } from './components/code.js';
import { renderImage } from './components/image.js';
const STRUCTURAL_DIRECTIVES = new Set(['cover', 'toc', 'section']);
const SKIP_BODY_DIRECTIVES = new Set(['toc']);
export function renderReport(input) {
    const warnings = [];
    const doc = parseDocument(input.irContent);
    if (doc.frontmatterWarnings.length > 0) {
        warnings.push(...doc.frontmatterWarnings);
    }
    // Animated render modes replace the standard shell entirely
    if (isAnimatedMode(doc.frontmatter.animations)) {
        return renderAnimated(input, doc, warnings);
    }
    const themeName = input.themeOverride ?? doc.frontmatter.theme;
    const theme = loadTheme(themeName);
    const css = assembleCSS(theme, doc.frontmatter.theme_overrides);
    const lang = doc.frontmatter.lang ?? 'zh';
    const animations = doc.frontmatter.animations !== false;
    const toc = doc.frontmatter.toc !== false;
    const renderOpts = { theme: themeName, lang, animations };
    // Cover (hero): rendered when `cover: hero` is set, or always for
    // forest-editorial (the theme ships a cover-first layout).
    const titleAccent = splitAccentPhrase(doc.frontmatter.title || 'Report');
    const titlePlain = titleAccent.plain;
    const coverEnabled = !isAnimatedMode(doc.frontmatter.animations)
        && shouldRenderCover(doc.frontmatter.cover, themeName);
    const coverHtml = coverEnabled
        ? renderCoverSection({
            cover: normaliseCover(parseCoverBody(doc.coverBody ?? ''), warnings),
            titleHtml: titleAccent.html,
            abstract: doc.frontmatter.abstract ?? '',
            author: doc.frontmatter.author ?? '',
            date: doc.frontmatter.date ?? '',
            lang,
        })
        : undefined;
    if (coverEnabled && doc.coverBody === null && doc.frontmatter.cover === 'hero') {
        warnings.push('cover: hero requested but no :::cover fence found; rendering cover from frontmatter only');
    }
    // Detect CDN needs
    const needsEcharts = doc.blocks.some(b => b.tag === 'chart');
    const needsHighlightjs = doc.blocks.some(b => b.tag === 'code');
    // Render sections
    const bodyParts = [];
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
        let skipDirectiveBody = false;
        let proseBuffer = [];
        const flushProse = () => {
            if (proseBuffer.length === 0)
                return;
            const text = proseBuffer.join(' ').trim();
            if (text) {
                // Check if the prose is a standalone HTML block element (div, p with class, etc.)
                const isHtmlBlock = /^<(div|p)\s/.test(text) && text.endsWith('>');
                if (isHtmlBlock) {
                    if (animations) {
                        // Merge animation class into existing class attr, or add new one
                        if (/class="/.test(text)) {
                            bodyParts.push(`          ${text.replace(/class="/, 'class="fade-in-up ')}`);
                        }
                        else {
                            bodyParts.push(`          ${text.replace(/^<(\w+)/, '<$1 class="fade-in-up"')}`);
                        }
                    }
                    else {
                        bodyParts.push(`          ${text}`);
                    }
                }
                else {
                    const proseClass = animations ? ' class="fade-in-up"' : '';
                    bodyParts.push(`          <p${proseClass}>${renderInlineMarkdown(text)}</p>`);
                }
            }
            proseBuffer = [];
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (skipDirectiveBody) {
                if (trimmed === ':::')
                    skipDirectiveBody = false;
                continue;
            }
            // Skip section headings (already rendered above)
            if (trimmed.startsWith('##'))
                continue;
            // Block open
            const directiveOpen = parseDirectiveOpen(trimmed);
            if (directiveOpen) {
                flushProse();
                if (STRUCTURAL_DIRECTIVES.has(directiveOpen.tag)) {
                    skipDirectiveBody = SKIP_BODY_DIRECTIVES.has(directiveOpen.tag);
                    continue;
                }
                inBlock = true;
                continue;
            }
            // Block close — render the next queued block
            if (trimmed === ':::') {
                inBlock = false;
                if (blockQueue.length > 0) {
                    const block = blockQueue.shift();
                    const html = renderBlock(block, renderOpts);
                    if (html)
                        bodyParts.push(html);
                }
                continue;
            }
            // Inside a block — skip (block renderer handles it)
            if (inBlock)
                continue;
            // Horizontal rule
            if (trimmed === '---') {
                flushProse();
                continue;
            }
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                flushProse();
                const headingLevel = Math.min(section.level + 1, 6);
                const headingText = headingMatch[2].trim();
                bodyParts.push(`          <h${headingLevel}>${renderInlineMarkdown(headingText)}</h${headingLevel}>`);
                continue;
            }
            if (isMarkdownTableStart(lines, i)) {
                flushProse();
                const tableLines = [];
                while (i < lines.length && isMarkdownTableLine(lines[i])) {
                    tableLines.push(renderInlineMarkdown(lines[i].trim()));
                    i += 1;
                }
                i -= 1;
                const html = renderBlock(markdownBlock('table', tableLines.join('\n')), renderOpts);
                if (html)
                    bodyParts.push(html);
                continue;
            }
            const listStyle = markdownListStyle(trimmed);
            if (listStyle) {
                flushProse();
                const listLines = [];
                while (i < lines.length && markdownListStyle(lines[i].trim()) === listStyle) {
                    listLines.push(renderInlineMarkdown(lines[i].trim()));
                    i += 1;
                }
                i -= 1;
                const html = renderBlock(markdownBlock('list', listLines.join('\n'), { style: listStyle }), renderOpts);
                if (html)
                    bodyParts.push(html);
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
    // Build report-summary JSON (plain title — no [[accent]] markup)
    const reportSummary = {
        title: titlePlain,
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
    // Compute IR hash (normalize_text parity: strip + trailing newline)
    const normalizedIr = input.irContent.trim() ? input.irContent.trim() + '\n' : '';
    const irHash = createHash('sha256').update(normalizedIr).digest('hex').slice(0, 16);
    // TOC items
    const tocItems = doc.sections.map(s => ({
        slug: s.slug,
        text: s.heading,
        level: s.level,
    }));
    const shellOpts = {
        title: titlePlain,
        theme: themeName,
        lang,
        css,
        needsEcharts,
        needsHighlightjs,
        toc,
        animations: !isAnimatedMode(doc.frontmatter.animations),
        irHash,
        reportSummaryJson: JSON.stringify(reportSummary),
        bodyContent: bodyParts.join('\n'),
        tocItems,
        author: doc.frontmatter.author ?? '',
        date: doc.frontmatter.date ?? '',
        abstract: doc.frontmatter.abstract ?? '',
        version: '2.0.0',
        // JSON-LD also uses the plain title form
        frontmatter: { ...doc.frontmatter, title: titlePlain },
        coverHtml,
    };
    const html = buildHtmlShell(shellOpts);
    // Validate output
    const validation = validateOutput(html);
    if (!validation.l0)
        warnings.push('L0 validation failed: possible ::: leakage or missing ir-hash');
    if (!validation.l1)
        warnings.push('L1 validation failed: shell structure incomplete');
    if (!validation.l2) {
        warnings.push('L2 validation failed: missing required IDs');
        for (const f of validation.coverFindings)
            warnings.push(`cover: ${f}`);
    }
    if (!validation.l3)
        warnings.push(`L3 validation failed: ${validation.qualityFindings.join('; ')}`);
    // Write file
    const outputPath = input.outputPath ?? `report-${doc.frontmatter.date || 'output'}.html`;
    try {
        writeFileSync(outputPath, html, 'utf-8');
    }
    catch (e) {
        warnings.push(`Failed to write file: ${e.message}`);
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
function markdownBlock(tag, body, params = {}) {
    return { tag, body, params, lineStart: 0, lineEnd: 0 };
}
function isMarkdownTableStart(lines, index) {
    return isMarkdownTableLine(lines[index] || '') && isMarkdownTableSeparator(lines[index + 1] || '');
}
function isMarkdownTableLine(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3;
}
function isMarkdownTableSeparator(line) {
    const trimmed = line.trim();
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed);
}
function markdownListStyle(line) {
    if (/^[-*]\s+/.test(line))
        return 'unordered';
    if (/^\d+\.\s+/.test(line))
        return 'ordered';
    return null;
}
function parseDirectiveOpen(line) {
    const match = line.match(/^:::\s*(\w+)\b/);
    return match ? { tag: match[1] } : null;
}
function renderInlineMarkdown(value) {
    const escaped = escHtmlPreserveInline(value);
    return escaped
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}
function renderBlock(block, options) {
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
function validateOutput(html) {
    // L0: No ::: leakage, ir-hash exists
    const hasIrHash = /meta\s+name="ir-hash"\s+content="[^"]+"/i.test(html);
    const visibleText = html
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n');
    const hasDirectiveLeak = visibleText
        .split('\n')
        .some(line => line.trim().includes(':::'));
    const l0Pass = !hasDirectiveLeak && hasIrHash;
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
    const coverFindings = validateCoverStructure(html);
    const l2Cover = coverFindings.length === 0;
    const qualityFindings = validateKpiValues(html);
    const l3 = qualityFindings.length === 0;
    return { l0: l0Pass, l1, l2: l2 && l2Cover, l3, qualityFindings, coverFindings };
}
/**
 * Cover structure rules, ported from report-creator scripts/html_quality_gate.py:
 * exactly one <h1> (inside #report-cover), cover is a sibling BEFORE
 * .report-wrapper, cards 0 or 3 with at most one accent, ≤ 4 chips,
 * watermark aria-hidden, single #card-mode-btn inside the cover,
 * no literal [[ ]] residue.
 */
function validateCoverStructure(html) {
    const findings = [];
    const theme = /data-theme="([^"]+)"/.exec(html)?.[1] ?? '';
    const mode = /data-cover="([^"]+)"/.exec(html)?.[1];
    if (theme === 'forest-editorial' && mode !== 'hero') {
        findings.push('forest-editorial implies a cover; <html> needs data-cover="hero"');
    }
    if (mode !== 'hero')
        return findings;
    // Strip scripts/styles so inner JS/CSS strings cannot fake markup
    const markup = html
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '');
    const coverStart = markup.indexOf('id="report-cover"');
    if (coverStart === -1) {
        findings.push('data-cover="hero" but no id="report-cover" element');
        return findings;
    }
    const coverEnd = markup.indexOf('</section>', coverStart);
    const coverSlice = markup.slice(coverStart, coverEnd === -1 ? undefined : coverEnd);
    const wrapperStart = markup.indexOf('class="report-wrapper"');
    if (coverStart > wrapperStart && wrapperStart !== -1) {
        findings.push('#report-cover must be a sibling before .report-wrapper');
    }
    const h1Total = (markup.match(/<h1[\s>]/g) ?? []).length;
    if (h1Total !== 1) {
        findings.push(`exactly one <h1> expected, found ${h1Total}`);
    }
    else if (!/<h1[\s>]/.test(coverSlice)) {
        findings.push('the single <h1> must live inside #report-cover');
    }
    const cards = (coverSlice.match(/class="cover-card"/g) ?? []).length;
    if (cards !== 0 && cards !== 3)
        findings.push(`.cover-card count must be 0 or 3, found ${cards}`);
    const accents = (coverSlice.match(/data-accent=/g) ?? []).length;
    if (accents > 1)
        findings.push(`at most one accent card, found ${accents}`);
    const chips = (coverSlice.match(/class="cover-chip"/g) ?? []).length;
    if (chips > 4)
        findings.push(`at most 4 chips, found ${chips}`);
    if (/class="cover-watermark"(?![^>]*aria-hidden="true")/.test(coverSlice)) {
        findings.push('.cover-watermark needs aria-hidden="true"');
    }
    const cardBtns = (markup.match(/id="card-mode-btn"/g) ?? []).length;
    if (cardBtns !== 1) {
        findings.push(`exactly one #card-mode-btn expected, found ${cardBtns}`);
    }
    else if (!coverSlice.includes('id="card-mode-btn"')) {
        findings.push('the #card-mode-btn must live inside #report-cover');
    }
    const titleText = /<title>([\s\S]*?)<\/title>/.exec(markup)?.[1] ?? '';
    const coverText = coverSlice.replace(/<[^>]+>/g, '');
    if (coverText.includes('[[') || coverText.includes(']]') || titleText.includes('[[') || titleText.includes(']]')) {
        findings.push('literal [[ or ]] survived into the rendered HTML');
    }
    return findings;
}
const PLACEHOLDER_RE = /\[(?:INSERT VALUE|数据待填写)\]/;
function hasRealNumber(value) {
    return /\d/.test(value) && !PLACEHOLDER_RE.test(value);
}
function stripTags(fragment) {
    return fragment.replace(/<[^>]+>/g, '').trim();
}
function validateKpiValues(html) {
    const findings = [];
    const kpiValuePattern = /<div\b[^>]*class="[^"]*\bkpi-value\b[^"]*"[^>]*>(.*?)<\/div>/gs;
    for (const match of html.matchAll(kpiValuePattern)) {
        const value = stripTags(match[1] ?? '');
        if (!hasRealNumber(value))
            findings.push(`invalid KPI value "${value}"`);
    }
    const summaryMatch = html.match(/<script\b[^>]*id="report-summary"[^>]*>\s*([\s\S]*?)\s*<\/script>/);
    if (!summaryMatch) {
        findings.push('missing report-summary JSON');
        return findings;
    }
    try {
        const summary = JSON.parse(summaryMatch[1] ?? '{}');
        if (Array.isArray(summary.kpis)) {
            for (const item of summary.kpis) {
                const value = String(item?.value ?? '').trim();
                if (value && !hasRealNumber(value))
                    findings.push(`invalid summary KPI value "${value}"`);
            }
        }
    }
    catch {
        findings.push('invalid report-summary JSON');
    }
    return findings;
}
/**
 * Animated render modes (scrollytelling / iridescence): the standard shell,
 * theme CSS, TOC/card/edit chrome and ECharts do NOT apply. Output carries
 * its own contract (data-render-mode, chrome IDs, pinned CDN allow-list or
 * zero-CDN, summary KPI rules) validated by validateAnimatedOutput.
 */
function renderAnimated(input, doc, warnings) {
    const mode = doc.frontmatter.animations;
    const lang = doc.frontmatter.lang ?? 'zh';
    const version = '2.0.0';
    const normalizedIr = input.irContent.trim() ? input.irContent.trim() + '\n' : '';
    const irHash = createHash('sha256').update(normalizedIr).digest('hex').slice(0, 16);
    const primaryColor = doc.frontmatter.theme_overrides?.['primary_color']
        ?? doc.frontmatter.theme_overrides?.['--primary']
        ?? '#5842EA';
    if (doc.frontmatter.cover === 'hero') {
        warnings.push('contract_conflict: cover: hero cannot combine with animated render modes — cover dropped');
    }
    const ctx = { doc, mode, lang, version, irHash, primaryColor, warnings };
    const html = mode === 'scrollytelling' ? buildScrollytelling(ctx) : buildIridescence(ctx);
    // L0: no ::: leakage, ir-hash present (same rule as the standard shell)
    const hasIrHash = /meta\s+name="ir-hash"\s+content="[^"]+"/i.test(html);
    const visibleText = html
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n');
    const l0 = !visibleText.split('\n').some(line => line.trim().includes(':::')) && hasIrHash;
    const l1 = html.includes('<!DOCTYPE html>') && html.includes('data-template="kai-report-creator"');
    const { chromeFindings, kpiFindings } = validateAnimatedOutput(html, mode, version);
    const l2 = chromeFindings.length === 0;
    const l3 = kpiFindings.length === 0;
    if (!l0)
        warnings.push('L0 validation failed: possible ::: leakage or missing ir-hash');
    if (!l2)
        for (const f of chromeFindings)
            warnings.push(`animated: ${f}`);
    if (!l3)
        warnings.push(`L3 validation failed: ${kpiFindings.join('; ')}`);
    const outputPath = input.outputPath ?? `report-${doc.frontmatter.date || 'output'}.html`;
    try {
        writeFileSync(outputPath, html, 'utf-8');
    }
    catch (e) {
        warnings.push(`Failed to write file: ${e.message}`);
    }
    return {
        success: l0 && l1 && l2 && l3,
        outputPath,
        html,
        validation: { l0, l1, l2, l3 },
        warnings,
        stats: {
            sections: doc.sections.length,
            components: doc.blocks.length,
            cssBytes: 0,
            htmlBytes: html.length,
        },
    };
}
//# sourceMappingURL=html-builder.js.map