import type { IRBlock } from '../parser/ir-parser.js';

export type ValidationStatus =
  | 'valid'
  | 'invalid_syntax'
  | 'invalid_semantics'
  | 'contract_conflict';

export interface BlockValidationResult {
  status: ValidationStatus;
  message?: string;
  autoDowngradeTarget?: string;
}

export interface DocumentValidationResult {
  valid: boolean;
  errors: Array<{
    blockIndex: number;
    tag: string;
    status: ValidationStatus;
    message: string;
    autoDowngradeTarget?: string;
  }>;
  blockCount: number;
  componentSummary: Record<string, number>;
}

// Date patterns for timeline validation (from contract_checks.py)
const TIMELINE_DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,           // 2024-03-15
  /^\d{4}-\d{2}$/,                  // 2024-03
  /^\d{4}$/,                         // 2024
  /^Q[1-4]\s+\d{4}$/,               // Q1 2024
  /^Day\s+\d+$/i,                   // Day 1
  /^Week\s+\d+$/i,                  // Week 1
  /^Phase\s+\d+$/i,                 // Phase 1
  /^Step\s+\d+$/i,                  // Step 1
  /^Sprint\s+\d+$/i,               // Sprint 1
  /^\d{4}年\d{1,2}月(\d{1,2}日)?$/, // 2024年3月15日
  /^\d{1,2}月\d{1,2}日$/,           // 3月15日
  /^第[一二三四]季度$/,               // 第一季度
];

const PLACEHOLDER_RE = /\[(?:INSERT VALUE|数据待填写)\]/;

/**
 * Validate all blocks in a document.
 */
export function validateBlocks(blocks: IRBlock[], reportClass: string): DocumentValidationResult {
  const errors: DocumentValidationResult['errors'] = [];
  const componentSummary: Record<string, number> = {};

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    componentSummary[block.tag] = (componentSummary[block.tag] ?? 0) + 1;

    const result = validateBlock(block, reportClass);
    if (result.status !== 'valid') {
      errors.push({
        blockIndex: i,
        tag: block.tag,
        status: result.status,
        message: result.message ?? `Invalid ${block.tag} block`,
        autoDowngradeTarget: result.autoDowngradeTarget,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    blockCount: blocks.length,
    componentSummary,
  };
}

/**
 * Dispatch validation to the appropriate handler.
 */
export function validateBlock(block: IRBlock, reportClass: string): BlockValidationResult {
  switch (block.tag) {
    case 'kpi':
      return validateKpi(block.body, reportClass);
    case 'timeline':
      return validateTimeline(block.body);
    case 'chart':
      return validateChart(block.params['type'] ?? '', block.body, reportClass);
    case 'diagram':
      return validateDiagram(block.params['type'] ?? '', block.body);
    case 'callout':
      return validateCallout(block.body, block.params);
    case 'table':
      return validateTable(block.body);
    case 'code':
      return validateCode(block.body, block.params);
    case 'image':
      return validateImage(block.body, block.params);
    case 'list':
      return validateList(block.body, block.params);
    default:
      return { status: 'invalid_syntax', message: `Unknown component tag: ${block.tag}` };
  }
}

/**
 * Validate KPI block.
 * Expects YAML-style items or short-line format.
 * Each value must be ≤24 chars, ≤3 English words, ≤8 Chinese chars.
 */
function validateKpi(body: string, reportClass: string): BlockValidationResult {
  const trimmed = body.trim();
  if (!trimmed) {
    return { status: 'invalid_syntax', message: 'Empty KPI block', autoDowngradeTarget: 'callout' };
  }

  // Check for YAML items format
  const hasItems = /items:/i.test(trimmed) || /^-\s/m.test(trimmed);
  if (!hasItems) {
    return { status: 'invalid_syntax', message: 'KPI block must contain items list', autoDowngradeTarget: 'callout' };
  }

  // Extract values and check length
  const valueMatches = trimmed.match(/value:\s*(.+)/g);
  if (valueMatches) {
    for (const match of valueMatches) {
      const value = match.replace(/value:\s*/, '').trim().replace(/^['"]|['"]$/g, '');
      if (value.length > 24) {
        return {
          status: 'invalid_semantics',
          message: `KPI value too long (${value.length} chars, max 24): "${value}"`,
        };
      }
      // Check Chinese char count
      const cjkChars = value.match(/[\u4e00-\u9fff]/g);
      if (cjkChars && cjkChars.length > 8) {
        return {
          status: 'invalid_semantics',
          message: `KPI value has too many CJK characters (${cjkChars.length}, max 8): "${value}"`,
        };
      }
    }
  }

  // Check for placeholder in data-heavy reports
  if (reportClass === 'data' && PLACEHOLDER_RE.test(trimmed)) {
    return {
      status: 'invalid_semantics',
      message: 'KPI block contains placeholder values in a data-class report',
    };
  }

  return { status: 'valid' };
}

/**
 * Validate timeline block.
 * Each line must be "- date: content" with a valid date format.
 */
function validateTimeline(body: string): BlockValidationResult {
  const trimmed = body.trim();
  if (!trimmed) {
    return { status: 'invalid_syntax', message: 'Empty timeline block', autoDowngradeTarget: 'list' };
  }

  const lines = trimmed.split('\n').filter(l => l.trim().startsWith('-'));
  if (lines.length === 0) {
    return { status: 'invalid_syntax', message: 'Timeline must have "- date: content" lines', autoDowngradeTarget: 'list' };
  }

  for (const line of lines) {
    const match = line.match(/^-\s*(.+?):\s*(.+)$/);
    if (!match) {
      return {
        status: 'invalid_syntax',
        message: `Invalid timeline line format: "${line.trim()}"`,
        autoDowngradeTarget: 'list',
      };
    }

    const date = match[1]!.trim();
    const isValidDate = TIMELINE_DATE_PATTERNS.some(p => p.test(date));
    if (!isValidDate) {
      return {
        status: 'invalid_syntax',
        message: `Invalid timeline date format: "${date}"`,
        autoDowngradeTarget: 'list',
      };
    }
  }

  return { status: 'valid' };
}

/**
 * Validate chart block.
 * Check required keys based on chart type.
 */
function validateChart(chartType: string, body: string, reportClass: string): BlockValidationResult {
  const trimmed = body.trim();
  if (!trimmed) {
    return { status: 'invalid_syntax', message: 'Empty chart block', autoDowngradeTarget: 'table' };
  }

  if (!chartType) {
    return { status: 'invalid_syntax', message: 'Chart block missing type parameter', autoDowngradeTarget: 'table' };
  }

  const validTypes = ['bar', 'line', 'pie', 'scatter', 'radar', 'funnel', 'sankey'];
  if (!validTypes.includes(chartType)) {
    return {
      status: 'invalid_syntax',
      message: `Unknown chart type "${chartType}", expected: ${validTypes.join(', ')}`,
      autoDowngradeTarget: 'table',
    };
  }

  // Check required keys by type
  const requiredKeys: Record<string, string[]> = {
    bar: ['labels', 'datasets'],
    line: ['labels', 'datasets'],
    pie: ['labels', 'datasets'],
    radar: ['labels', 'datasets'],
    scatter: ['points'],
    funnel: ['stages'],
    sankey: ['nodes', 'links'],
  };

  const required = requiredKeys[chartType] ?? [];
  for (const key of required) {
    const keyRegex = new RegExp(`^\\s*${key}:`, 'm');
    if (!keyRegex.test(trimmed)) {
      return {
        status: 'invalid_syntax',
        message: `Chart type "${chartType}" requires "${key}" field`,
        autoDowngradeTarget: 'table',
      };
    }
  }

  // Check placeholder
  if (reportClass === 'data' && PLACEHOLDER_RE.test(trimmed)) {
    return {
      status: 'invalid_semantics',
      message: 'Chart contains placeholder data in a data-class report',
      autoDowngradeTarget: 'table',
    };
  }

  return { status: 'valid' };
}

/**
 * Validate diagram block.
 */
function validateDiagram(diagramType: string, body: string): BlockValidationResult {
  const trimmed = body.trim();
  if (!trimmed) {
    return { status: 'invalid_syntax', message: 'Empty diagram block', autoDowngradeTarget: 'callout' };
  }

  if (!diagramType) {
    return { status: 'invalid_syntax', message: 'Diagram block missing type parameter', autoDowngradeTarget: 'callout' };
  }

  const validTypes = ['sequence', 'flowchart', 'tree', 'mindmap'];
  if (!validTypes.includes(diagramType)) {
    return {
      status: 'invalid_syntax',
      message: `Unknown diagram type "${diagramType}", expected: ${validTypes.join(', ')}`,
      autoDowngradeTarget: 'callout',
    };
  }

  const requiredKeys: Record<string, string[]> = {
    sequence: ['actors', 'steps'],
    flowchart: ['nodes', 'edges'],
    tree: ['root'],
    mindmap: ['root'],
  };

  const required = requiredKeys[diagramType] ?? [];
  for (const key of required) {
    const keyRegex = new RegExp(`^\\s*${key}:`, 'm');
    if (!keyRegex.test(trimmed)) {
      return {
        status: 'invalid_syntax',
        message: `Diagram type "${diagramType}" requires "${key}" field`,
        autoDowngradeTarget: 'callout',
      };
    }
  }

  return { status: 'valid' };
}

/**
 * Validate callout block.
 */
function validateCallout(body: string, params: Record<string, string>): BlockValidationResult {
  if (!body.trim()) {
    return { status: 'invalid_syntax', message: 'Empty callout block' };
  }
  const validTypes = ['note', 'tip', 'warning', 'danger'];
  const type = params['type'] ?? 'note';
  if (!validTypes.includes(type)) {
    return { status: 'invalid_syntax', message: `Invalid callout type "${type}", expected: ${validTypes.join(', ')}` };
  }
  return { status: 'valid' };
}

/**
 * Validate table block.
 */
function validateTable(body: string): BlockValidationResult {
  const trimmed = body.trim();
  if (!trimmed) {
    return { status: 'invalid_syntax', message: 'Empty table block' };
  }
  // Must have at least header + separator + one row
  const lines = trimmed.split('\n').filter(l => l.trim());
  if (lines.length < 3) {
    return { status: 'invalid_syntax', message: 'Table must have header, separator, and at least one data row' };
  }
  // Check separator line
  const hasSeparator = lines.some(l => /^\|?[\s-:|]+\|?$/.test(l));
  if (!hasSeparator) {
    return { status: 'invalid_syntax', message: 'Table missing Markdown separator row (|---|---|)' };
  }
  return { status: 'valid' };
}

/**
 * Validate code block.
 */
function validateCode(body: string, params: Record<string, string>): BlockValidationResult {
  if (!body.trim()) {
    return { status: 'invalid_syntax', message: 'Empty code block' };
  }
  return { status: 'valid' };
}

/**
 * Validate image block.
 */
function validateImage(body: string, params: Record<string, string>): BlockValidationResult {
  const src = params['src'] ?? '';
  if (!src && !body.trim()) {
    return { status: 'invalid_syntax', message: 'Image block must have src parameter or body content' };
  }
  return { status: 'valid' };
}

/**
 * Validate list block.
 */
function validateList(body: string, params: Record<string, string>): BlockValidationResult {
  if (!body.trim()) {
    return { status: 'invalid_syntax', message: 'Empty list block' };
  }
  const style = params['style'] ?? 'unordered';
  if (!['ordered', 'unordered'].includes(style)) {
    return { status: 'invalid_syntax', message: `Invalid list style "${style}", expected: ordered, unordered` };
  }
  return { status: 'valid' };
}
