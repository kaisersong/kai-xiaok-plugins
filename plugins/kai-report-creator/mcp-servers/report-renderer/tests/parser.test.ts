import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument, parseBlocks, parseSections } from '../src/parser/ir-parser.js';
import { parseFrontmatter } from '../src/parser/frontmatter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parseFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const source = loadFixture('valid-mixed.report.md');
    const { frontmatter, warnings } = parseFrontmatter(source);

    expect(frontmatter.title).toBe('AI 技术趋势报告');
    expect(frontmatter.theme).toBe('corporate-blue');
    expect(frontmatter.lang).toBe('zh');
    expect(frontmatter.report_class).toBe('mixed');
    expect(frontmatter.toc).toBe(true);
    expect(frontmatter.animations).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it('warns on unknown theme', () => {
    const source = loadFixture('invalid-blocks.report.md');
    const { warnings } = parseFrontmatter(source);

    expect(warnings.some(w => w.includes('Unknown theme'))).toBe(true);
  });

  it('warns on invalid report_class', () => {
    const source = loadFixture('invalid-blocks.report.md');
    const { warnings } = parseFrontmatter(source);

    expect(warnings.some(w => w.includes('Invalid report_class'))).toBe(true);
  });

  it('handles missing frontmatter', () => {
    const { frontmatter, warnings } = parseFrontmatter('# Hello\nWorld');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('No frontmatter found');
    expect(frontmatter.theme).toBe('corporate-blue'); // default
  });

  it('handles empty source', () => {
    const { frontmatter, warnings } = parseFrontmatter('');
    expect(warnings).toHaveLength(1);
  });
});

describe('parseBlocks', () => {
  it('parses ::: blocks from body', () => {
    const body = `## Section

:::kpi
items:
  - label: DAU
    value: 100万
:::

Some text

:::chart type=bar
labels: [a, b, c]
datasets:
  - name: test
    data: [1, 2, 3]
:::`;

    const blocks = parseBlocks(body);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.tag).toBe('kpi');
    expect(blocks[0]!.body).toContain('items:');
    expect(blocks[1]!.tag).toBe('chart');
    expect(blocks[1]!.params['type']).toBe('bar');
  });

  it('handles params with quotes', () => {
    const body = `:::chart type=line title="Monthly Revenue"
labels: [Jan, Feb]
:::`;
    const blocks = parseBlocks(body);
    expect(blocks[0]!.params['type']).toBe('line');
    expect(blocks[0]!.params['title']).toBe('Monthly Revenue');
  });

  it('returns empty array for no blocks', () => {
    const blocks = parseBlocks('Just plain text\nNo blocks here');
    expect(blocks).toHaveLength(0);
  });
});

describe('parseSections', () => {
  it('splits on ## headings', () => {
    const body = `## First Section

Content 1

## Second Section

Content 2

### Sub Section

Sub content`;

    const blocks = parseBlocks(body);
    const sections = parseSections(body, blocks);

    expect(sections).toHaveLength(3);
    expect(sections[0]!.heading).toBe('First Section');
    expect(sections[0]!.level).toBe(2);
    expect(sections[1]!.heading).toBe('Second Section');
    expect(sections[2]!.heading).toBe('Sub Section');
    expect(sections[2]!.level).toBe(3);
  });

  it('assigns blocks to correct sections', () => {
    const body = `## Section A

:::kpi
items:
  - label: X
    value: 1
:::

## Section B

:::table
| A | B |
|---|---|
| 1 | 2 |
:::`;

    const blocks = parseBlocks(body);
    const sections = parseSections(body, blocks);

    expect(sections[0]!.blocks).toHaveLength(1);
    expect(sections[0]!.blocks[0]!.tag).toBe('kpi');
    expect(sections[1]!.blocks).toHaveLength(1);
    expect(sections[1]!.blocks[0]!.tag).toBe('table');
  });
});

describe('parseDocument', () => {
  it('parses complete document', () => {
    const source = loadFixture('valid-mixed.report.md');
    const doc = parseDocument(source);

    expect(doc.frontmatter.title).toBe('AI 技术趋势报告');
    expect(doc.blocks.length).toBeGreaterThan(0);
    expect(doc.sections.length).toBeGreaterThan(0);

    // Check block types found
    const tags = doc.blocks.map(b => b.tag);
    expect(tags).toContain('kpi');
    expect(tags).toContain('chart');
    expect(tags).toContain('timeline');
    expect(tags).toContain('callout');
    expect(tags).toContain('table');
  });
});
