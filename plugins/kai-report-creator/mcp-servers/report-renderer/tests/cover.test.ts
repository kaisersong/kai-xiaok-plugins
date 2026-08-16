import { describe, it, expect } from 'vitest';
import { renderReport as renderReportRaw } from '../src/renderer/html-builder.js';
import { parseCoverBody, normaliseCover, splitAccentPhrase, shouldRenderCover } from '../src/renderer/cover.js';

// Keep test renders out of the package working directory
const renderReport = (input: Parameters<typeof renderReportRaw>[0]) =>
  renderReportRaw({ outputPath: '/tmp/kai-report-cover-test.html', ...input });

function coverIR(fmOverrides: Record<string, string> = {}, coverFence = ''): string {
  const fm: Record<string, string> = {
    title: '季度经营[[复盘]]报告',
    theme: 'default',
    date: '2025-06-30',
    abstract: '三分钟看完本季度经营全貌。',
    author: '战略经营部',
    cover: 'hero',
    ...fmOverrides,
  };
  const lines = [
    '---',
    ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`),
    '---',
    '',
    coverFence,
    '## 市场概况',
    '',
    '本季度市场稳中有进。',
    '',
    ':::kpi',
    '- label: 营收',
    '  value: 1.2亿',
    '  trend: +18%',
    ':::',
    '',
  ];
  return lines.join('\n');
}

const heroFence = [
  ':::cover',
  'eyebrow: 2025 Q2 BUSINESS REVIEW',
  'chips:',
  '  - 增长',
  '  - 提效',
  '  - 风控',
  '  - 组织',
  '  - 第五个会被丢弃',
  'cards:',
  '  - label: GROWTH',
  '    title: 营收增长 18%',
  '    text: 核心业务线连续三个季度加速',
  '    accent: true',
  '  - label: EFFICIENCY',
  '    title: 人效提升 12%',
  '    text: 流程自动化覆盖率过半',
  '  - label: RISK',
  '    title: 风险敞口收窄',
  '    text: 逾期率降至 1.4%',
  'watermark: REVIEW',
  ':::',
  '',
].join('\n');

describe('cover rendering', () => {
  it('renders hero cover when cover: hero is set', () => {
    const result = renderReport({ irContent: coverIR({}, heroFence) });
    expect(result.success).toBe(true);
    expect(result.html).toContain('data-cover="hero"');
    expect(result.html).toContain('id="report-cover"');
    expect(result.html).toContain('class="report-cover"');
  });

  it('moves the single h1 and card button into the cover, before the wrapper', () => {
    const result = renderReport({ irContent: coverIR({}, heroFence) });
    const h1s = result.html.match(/<h1[\s>]/g) ?? [];
    expect(h1s.length).toBe(1);
    expect(result.html).not.toContain('<div class="title-row">');
    const coverIdx = result.html.indexOf('id="report-cover"');
    const coverEnd = result.html.indexOf('</section>', coverIdx);
    const wrapperIdx = result.html.indexOf('class="report-wrapper"');
    expect(coverIdx).toBeLessThan(wrapperIdx);
    expect(result.html.slice(coverIdx, coverEnd)).toContain('id="card-mode-btn"');
    expect(result.html).toContain('cover-highlight">复盘</span>');
  });

  it('uses the plain title in <title>, report-summary and JSON-LD', () => {
    const result = renderReport({ irContent: coverIR({}, heroFence) });
    expect(result.html).toContain('<title>季度经营复盘报告</title>');
    expect(result.html).not.toMatch(/<title>[^<]*\[\[/);
    const summary = /<script type="application\/json" id="report-summary">([\s\S]*?)<\/script>/.exec(result.html)?.[1];
    expect(JSON.parse(summary!).title).toBe('季度经营复盘报告');
    expect(summary).not.toContain('[[');
    const jsonLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(result.html)?.[1];
    expect(jsonLd).not.toContain('[[');
  });

  it('normalises chips to 4 and keeps only the first accent', () => {
    const warnings: string[] = [];
    const spec = parseCoverBody(heroFence.replace(/^:::cover\n/, '').replace(/\n:::$/, ''));
    const cover = normaliseCover(spec, warnings);
    expect(cover.chips).toHaveLength(4);
    expect(cover.chips).not.toContain('第五个会被丢弃');
    expect(cover.cards).toHaveLength(3);
    expect(cover.cards.filter(c => c.accent)).toHaveLength(1);

    const result = renderReport({ irContent: coverIR({}, heroFence) });
    expect((result.html.match(/class="cover-chip"/g) ?? []).length).toBe(4);
    expect((result.html.match(/data-accent=/g) ?? []).length).toBe(1);
    expect(result.html).toContain('aria-hidden="true"');
  });

  it('drops the card strip when cards are not exactly 3', () => {
    const twoCards = heroFence.replace(/  - label: RISK\n    title: 风险敞口收窄\n    text: 逾期率降至 1.4%\n/, '');
    const warnings: string[] = [];
    const cover = normaliseCover(parseCoverBody(twoCards.replace(/^:::cover\n/, '').replace(/\n:::$/, '')), warnings);
    expect(cover.cards).toHaveLength(0);
    expect(warnings.some(w => w.includes('3 or none'))).toBe(true);
    const result = renderReport({ irContent: coverIR({}, twoCards) });
    expect(result.html).not.toContain('class="cover-cards"');
    expect(result.success).toBe(true);
  });

  it('includes COVER_CSS only when a cover is rendered', () => {
    const withCover = renderReport({ irContent: coverIR({}, heroFence) });
    expect(withCover.html).toContain('/* === Report Cover (hero) === */');
    const withoutCover = renderReport({ irContent: coverIR({ cover: 'none' }) });
    expect(withoutCover.html).not.toContain('data-cover="hero"');
    expect(withoutCover.html).not.toContain('/* === Report Cover (hero) === */');
    expect(withoutCover.html).toContain('<div class="title-row">');
  });

  it('always renders a cover for forest-editorial', () => {
    const result = renderReport({ irContent: coverIR({ theme: 'forest-editorial', cover: 'none' }, heroFence) });
    expect(result.html).toContain('data-cover="hero"');
    expect(result.success).toBe(true);
  });

  it('does not render a cover in animated modes', () => {
    const result = renderReport({ irContent: coverIR({ animations: 'scrollytelling' }, heroFence) });
    expect(result.html).not.toContain('data-cover="hero"');
  });

  it('keeps L2 validation green with a cover (single h1, single card button)', () => {
    const result = renderReport({ irContent: coverIR({}, heroFence) });
    expect(result.validation.l2).toBe(true);
    expect(result.warnings.filter(w => w.startsWith('cover:'))).toHaveLength(0);
  });

  it('warns when cover: hero has no :::cover fence', () => {
    const result = renderReport({ irContent: coverIR() });
    expect(result.html).toContain('data-cover="hero"');
    expect(result.warnings.some(w => w.includes('no :::cover fence'))).toBe(true);
    expect(result.success).toBe(true);
  });
});

describe('cover unit helpers', () => {
  it('splitAccentPhrase handles titles without markers', () => {
    const { plain, html } = splitAccentPhrase('普通标题');
    expect(plain).toBe('普通标题');
    expect(html).toBe('普通标题');
  });

  it('splitAccentPhrase escapes html in the accent form', () => {
    const { html } = splitAccentPhrase('A <b> [[x & y]]');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('<span class="cover-highlight">x &amp; y</span>');
  });

  it('parseCoverBody tolerates empty and invalid YAML', () => {
    expect(parseCoverBody('')).toEqual({});
    expect(parseCoverBody('::: [unclosed')).toEqual({});
  });

  it('shouldRenderCover only accepts hero flag or forest-editorial', () => {
    expect(shouldRenderCover('hero', 'default')).toBe(true);
    expect(shouldRenderCover(undefined, 'forest-editorial')).toBe(true);
    expect(shouldRenderCover(undefined, 'default')).toBe(false);
    expect(shouldRenderCover('none', 'default')).toBe(false);
  });

  it('eyebrow is trimmed to one line of ≤60 chars', () => {
    const warnings: string[] = [];
    const long = 'x'.repeat(80);
    const cover = normaliseCover({ eyebrow: `${long}\nsecond line` }, warnings);
    expect(cover.eyebrow).toBe('x'.repeat(60));
    expect(warnings.some(w => w.includes('eyebrow'))).toBe(true);
  });
});
