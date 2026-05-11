import type { IRSection, IRDocument } from '../parser/ir-parser.js';

export interface QualityHint {
  section_index: number;
  heading: string;
  rule: string;
  message: string;
}

/**
 * Content quality checks — moved from SKILL.md to programmatic validation.
 * Returns hints (non-blocking suggestions) rather than hard errors.
 */
export function checkContentQuality(doc: IRDocument): QualityHint[] {
  const hints: QualityHint[] = [];

  for (let i = 0; i < doc.sections.length; i++) {
    const section = doc.sections[i]!;
    if (section.level !== 2) continue; // Only check H2 sections

    // Rule: Badge usage — at least some sections should use badges
    // (checked globally below)

    // Rule: KPI value quality (already enforced in ir-validator, skip here)

    // Rule: Prose wall prevention — >3 consecutive paragraphs without a component
    checkProseWall(section, i, hints);

    // Rule: Scan-anchor coverage — at least one visual anchor per H2
    checkScanAnchor(section, i, hints);

    // Rule: Takeaway after data (check that kpi/chart/table blocks are followed by prose)
    checkTakeaway(section, i, hints);
  }

  // Rule: Badge coverage — at least 2 badge usages across the whole document
  checkBadgeCoverage(doc, hints);

  return hints;
}

/**
 * Prose wall: >3 consecutive paragraphs without component, list, or emphasis block.
 */
function checkProseWall(section: IRSection, idx: number, hints: QualityHint[]): void {
  const lines = section.content.split('\n');
  let consecutiveParagraphs = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { continue; } // blank line
    // Check if it's a component, heading, list item, highlight, or callout
    const isAnchor = /^:::/.test(trimmed) ||
      /^#{1,6}\s/.test(trimmed) ||
      /^[-*]\s/.test(trimmed) ||
      /class="highlight-sentence"/.test(trimmed) ||
      /class="lead-block"/.test(trimmed) ||
      /class="action-grid"/.test(trimmed) ||
      /class="section-quote"/.test(trimmed);

    if (isAnchor) {
      consecutiveParagraphs = 0;
    } else {
      consecutiveParagraphs++;
    }
  }

  if (consecutiveParagraphs > 6) { // ~3 paragraphs worth of lines
    hints.push({
      section_index: idx,
      heading: section.heading,
      rule: 'prose_wall',
      message: `Section has long consecutive prose without visual anchors. Consider inserting a :::callout, list, or highlight-sentence.`,
    });
  }
}

/**
 * Scan-anchor: every H2 section needs at least one visual anchor.
 */
function checkScanAnchor(section: IRSection, idx: number, hints: QualityHint[]): void {
  const hasComponent = section.blocks.length > 0;
  const hasHighlight = /class="highlight-sentence"|class="lead-block"|class="section-quote"/.test(section.content);
  const hasBold = /\*\*.+?\*\*/.test(section.content);

  if (!hasComponent && !hasHighlight && !hasBold) {
    hints.push({
      section_index: idx,
      heading: section.heading,
      rule: 'scan_anchor',
      message: `Section lacks visual anchors. Add at least one component (:::kpi, :::callout, etc.), bold text, or highlight-sentence.`,
    });
  }
}

/**
 * Takeaway: data blocks (kpi, chart, table) should be followed by interpretive prose.
 */
function checkTakeaway(section: IRSection, idx: number, hints: QualityHint[]): void {
  const dataBlocks = section.blocks.filter(b => ['kpi', 'chart', 'table'].includes(b.tag));
  if (dataBlocks.length === 0) return;

  // Simple heuristic: check that there's non-trivial prose after each data block
  const content = section.content;
  for (const block of dataBlocks) {
    const blockEnd = `:::`;
    // Find position of closing ::: for this block
    const bodyInContent = block.body.slice(0, 30);
    const blockPos = content.indexOf(bodyInContent);
    if (blockPos === -1) continue;

    // Look for the closing ::: after the block body
    const afterBlock = content.slice(blockPos + block.body.length);
    const closingIdx = afterBlock.indexOf(blockEnd);
    if (closingIdx === -1) continue;

    const afterClosing = afterBlock.slice(closingIdx + 3).trim();
    // Check first non-empty line after block
    const firstLine = afterClosing.split('\n').find(l => l.trim())?.trim() ?? '';
    // If it immediately jumps to another component or heading, no takeaway
    if (firstLine.startsWith(':::') || firstLine.startsWith('#') || firstLine === '') {
      hints.push({
        section_index: idx,
        heading: section.heading,
        rule: 'takeaway_missing',
        message: `A :::${block.tag} block is not followed by interpretive prose. Add a sentence explaining what the data means.`,
      });
      break; // One hint per section is enough
    }
  }
}

/**
 * Badge coverage: at least 2 badge usages in the full document.
 */
function checkBadgeCoverage(doc: IRDocument, hints: QualityHint[]): void {
  const badgeCount = (doc.rawBody.match(/class="badge\s/g) || []).length;
  if (badgeCount < 2 && doc.sections.length >= 3) {
    hints.push({
      section_index: -1,
      heading: '(global)',
      rule: 'badge_coverage',
      message: `Report has ${badgeCount} badge(s), consider using <span class="badge badge--{type}">text</span> in at least 2 locations for status/category indicators.`,
    });
  }
}
