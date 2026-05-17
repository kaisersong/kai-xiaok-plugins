import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from '../src/parser/ir-parser.js';
import { validateBlocks, validateBlock } from '../src/validation/ir-validator.js';
import { handleValidateIR } from '../src/tools/validate-ir.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('validateBlocks', () => {
  it('validates a correct mixed report', () => {
    const doc = parseDocument(loadFixture('valid-mixed.report.md'));
    const result = validateBlocks(doc.blocks, doc.frontmatter.report_class);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.blockCount).toBe(5); // kpi, chart, timeline, callout, table
    expect(result.componentSummary['kpi']).toBe(1);
    expect(result.componentSummary['chart']).toBe(1);
    expect(result.componentSummary['timeline']).toBe(1);
  });

  it('catches errors in invalid blocks', () => {
    const doc = parseDocument(loadFixture('invalid-blocks.report.md'));
    const result = validateBlocks(doc.blocks, 'mixed');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('validateBlock - KPI', () => {
  it('accepts valid KPI', () => {
    const result = validateBlock(
      { tag: 'kpi', params: {}, body: 'items:\n  - label: DAU\n    value: 1200万\n    trend: +23%', lineStart: 0, lineEnd: 4 },
      'mixed',
    );
    expect(result.status).toBe('valid');
  });

  it('rejects empty KPI', () => {
    const result = validateBlock(
      { tag: 'kpi', params: {}, body: '', lineStart: 0, lineEnd: 0 },
      'mixed',
    );
    expect(result.status).toBe('invalid_syntax');
    expect(result.autoDowngradeTarget).toBe('callout');
  });

  it('rejects KPI with too-long value', () => {
    const result = validateBlock(
      { tag: 'kpi', params: {}, body: 'items:\n  - label: X\n    value: 这是一个超过八个中文字符的非常长的值', lineStart: 0, lineEnd: 3 },
      'mixed',
    );
    expect(result.status).toBe('invalid_semantics');
  });

  it('rejects KPI values that do not contain a real number', () => {
    const result = validateBlock(
      { tag: 'kpi', params: {}, body: 'items:\n  - label: 项目状态\n    value: 完成\n    trend: 状态值', lineStart: 0, lineEnd: 4 },
      'mixed',
    );
    expect(result.status).toBe('invalid_semantics');
    expect(result.message).toContain('real number');
  });
});

describe('validateBlock - Timeline', () => {
  it('accepts valid timeline', () => {
    const result = validateBlock(
      { tag: 'timeline', params: {}, body: '- 2026-01: First event\n- 2026-02: Second event', lineStart: 0, lineEnd: 2 },
      'mixed',
    );
    expect(result.status).toBe('valid');
  });

  it('rejects timeline without date format', () => {
    const result = validateBlock(
      { tag: 'timeline', params: {}, body: '- 没有冒号分隔\n- 也没有日期格式', lineStart: 0, lineEnd: 2 },
      'mixed',
    );
    expect(result.status).toBe('invalid_syntax');
    expect(result.autoDowngradeTarget).toBe('list');
  });

  it('accepts Chinese date format', () => {
    const result = validateBlock(
      { tag: 'timeline', params: {}, body: '- 2026年3月: 上线\n- 2026年5月15日: 发布', lineStart: 0, lineEnd: 2 },
      'mixed',
    );
    expect(result.status).toBe('valid');
  });
});

describe('validateBlock - Chart', () => {
  it('accepts valid bar chart', () => {
    const result = validateBlock(
      { tag: 'chart', params: { type: 'bar' }, body: 'labels: [a, b]\ndatasets:\n  - name: x\n    data: [1, 2]', lineStart: 0, lineEnd: 4 },
      'mixed',
    );
    expect(result.status).toBe('valid');
  });

  it('rejects chart without type', () => {
    const result = validateBlock(
      { tag: 'chart', params: {}, body: 'labels: [a]\ndatasets:\n  - data: [1]', lineStart: 0, lineEnd: 3 },
      'mixed',
    );
    expect(result.status).toBe('invalid_syntax');
    expect(result.message).toContain('missing type');
  });

  it('rejects chart missing required fields', () => {
    const result = validateBlock(
      { tag: 'chart', params: { type: 'sankey' }, body: 'nodes: [a, b]', lineStart: 0, lineEnd: 1 },
      'mixed',
    );
    expect(result.status).toBe('invalid_syntax');
    expect(result.message).toContain('links');
  });
});

describe('handleValidateIR (tool handler)', () => {
  it('returns valid for good IR', () => {
    const result = handleValidateIR({ ir_content: loadFixture('valid-mixed.report.md') });
    expect(result.valid).toBe(true);
    expect(result.block_count).toBe(5);
  });

  it('returns errors for bad IR', () => {
    const result = handleValidateIR({ ir_content: loadFixture('invalid-blocks.report.md') });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.frontmatter_warnings.length).toBeGreaterThan(0);
  });

  it('handles empty input', () => {
    const result = handleValidateIR({ ir_content: '' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.message).toContain('Empty');
  });
});
