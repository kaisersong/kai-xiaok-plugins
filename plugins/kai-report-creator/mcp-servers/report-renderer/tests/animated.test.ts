import { describe, it, expect } from 'vitest';
import { renderReport as renderReportRaw } from '../src/renderer/html-builder.js';
import { parseChartSeries, validateAnimatedOutput, SCROLLYTELLING_SCRIPTS } from '../src/renderer/animated/common.js';

// Keep test renders out of the package working directory
const renderReport = (input: Parameters<typeof renderReportRaw>[0]) =>
  renderReportRaw({ outputPath: '/tmp/kai-report-animated-test.html', ...input });

function animatedIR(animations: string, extraFm: Record<string, string> = {}): string {
  const fm: Record<string, string> = {
    title: '动效经营报告',
    theme: 'default',
    date: '2025-06-30',
    abstract: '一页滚动看完季度经营。',
    animations,
    ...extraFm,
  };
  return [
    '---',
    ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`),
    '---',
    '',
    '## 核心指标',
    '',
    '本季度稳中有进。',
    '',
    ':::kpi',
    '- label: 营收',
    '  value: 1.2亿',
    '  trend: +18%',
    '- label: 人效',
    '  value: 96万',
    ':::',
    '',
    ':::chart',
    'type: bar',
    'labels: [Q1, Q2, Q3, Q4]',
    'datasets:',
    '  - name: 营收',
    '    data: [32, 41, 47, 52]',
    ':::',
    '',
    ':::chart',
    'type: line',
    'labels: [1月, 2月, 3月]',
    'datasets:',
    '  - name: 增速',
    '    data: [5, 9, 12]',
    ':::',
    '',
    ':::callout',
    '量利齐升、结构向优。',
    ':::',
    '',
    ':::table',
    '| 指标 | Q1 | Q2 |',
    '| --- | --- | --- |',
    '| 营收 | 32 | 41 |',
    ':::',
    '',
  ].join('\n');
}

describe('scrollytelling mode', () => {
  it('renders an animated single-file page with the mode contract', () => {
    const result = renderReport({ irContent: animatedIR('scrollytelling') });
    expect(result.success).toBe(true);
    expect(result.html).toContain('data-render-mode="animated"');
    expect(result.html).toContain('data-animation="scrollytelling"');
    expect(result.html).toContain('data-theme="scrollytelling"');
    expect(result.html).not.toContain('data-cover="hero"');
    // standard shell chrome must NOT be asserted/present
    expect(result.html).not.toContain('id="toc-sidebar"');
    expect(result.html).not.toContain('id="export-btn"');
  });

  it('loads exactly the three pinned CDN scripts with SRI', () => {
    const result = renderReport({ irContent: animatedIR('scrollytelling') });
    const srcs = [...result.html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]!);
    expect(srcs).toHaveLength(3);
    expect(srcs).toEqual(SCROLLYTELLING_SCRIPTS.map(s => s.src));
    for (const s of SCROLLYTELLING_SCRIPTS) {
      expect(result.html).toContain(`integrity="${s.integrity}"`);
    }
    // no ECharts / highlight.js CDN sneaks in
    expect(result.html).not.toContain('echarts');
  });

  it('has the chrome contract IDs as real elements', () => {
    const result = renderReport({ irContent: animatedIR('scrollytelling') });
    const markup = result.html
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '');
    expect(markup).toContain('id="play-btn"');
    expect(markup).toContain('id="nav-sections"');
  });

  it('maps IR to hero + sections with kickers, chart data, KPI cards, summary JSON', () => {
    const result = renderReport({ irContent: animatedIR('scrollytelling') });
    expect(result.html).toContain('id="s0"');
    expect(result.html).toMatch(/0[0-9] \/ /);
    expect(result.html).toContain('data-chart=');
    expect(result.html).toContain('kpi-value');
    const summary = /<script type="application\/json" id="report-summary">([\s\S]*?)<\/script>/.exec(result.html)?.[1];
    const parsed = JSON.parse(summary!);
    expect(parsed.kpis.length).toBeGreaterThanOrEqual(2);
    expect(parsed.theme).toBe('scrollytelling');
    expect(result.validation.l3).toBe(true);
  });

  it('keeps CountUp fallback and per-section ScrollTrigger runtime', () => {
    const result = renderReport({ irContent: animatedIR('scrollytelling') });
    expect(result.html).toContain('countUp.CountUp');
    expect(result.html).toContain("gsap.registerPlugin(ScrollTrigger)");
    expect(result.html).toContain("ScrollTrigger.create");
    expect(result.html).toContain('scrollIntoView');
  });
});

describe('iridescence mode', () => {
  it('renders zero-CDN light page with shader hero and fallback', () => {
    const result = renderReport({ irContent: animatedIR('iridescence') });
    expect(result.success).toBe(true);
    expect(result.html).toContain('data-animation="iridescence"');
    expect(result.html).toContain('data-theme="iridescence"');
    const srcs = [...result.html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]!);
    expect(srcs).toHaveLength(0);
    const links = [...result.html.matchAll(/<link\b[^>]*href="(https?:[^"]+)"/g)].map(m => m[1]!);
    expect(links).toHaveLength(0);
    expect(result.html).toContain('canvas.style.background');
    expect(result.html).toContain('getContext(\'webgl\')');
    expect(result.html).toContain('IntersectionObserver');
  });

  it('renders bars with ghost fills for undisclosed values', () => {
    const ir = animatedIR('iridescence').replace('data: [32, 41, 47, 52]', 'data: [32, 41, null, 52]');
    const result = renderReport({ irContent: ir });
    expect(result.html).toContain('bar-fill');
    expect(result.html).toContain('未公开');
    expect(result.html).toContain('bar-fill ghost');
  });

  it('has chrome IDs and summary KPI contract', () => {
    const result = renderReport({ irContent: animatedIR('iridescence') });
    const markup = result.html
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '');
    expect(markup).toContain('id="play-btn"');
    expect(markup).toContain('id="nav-sections"');
    expect(result.validation.l2).toBe(true);
    expect(result.validation.l3).toBe(true);
  });
});

describe('animated contract conflicts', () => {
  it('cover: hero + animations mode is a contract_conflict', () => {
    const result = renderReport({ irContent: animatedIR('scrollytelling', { cover: 'hero' }) });
    expect(result.warnings.some(w => w.includes('contract_conflict'))).toBe(true);
    expect(result.html).not.toContain('id="report-cover"');
    expect(result.html).toContain('data-render-mode="animated"');
  });

  it('invalid animations value warns and renders the standard shell', () => {
    const result = renderReport({ irContent: animatedIR('marquee') });
    expect(result.warnings.some(w => w.includes('Invalid animations'))).toBe(true);
    expect(result.html).not.toContain('data-render-mode="animated"');
    expect(result.html).toContain('report-wrapper');
  });

  it('boolean animations never triggers animated mode', () => {
    const ir = animatedIR('true').replace('animations: true', 'animations: false');
    const result = renderReport({ irContent: ir });
    expect(result.html).not.toContain('data-render-mode="animated"');
  });
});

describe('animated unit helpers', () => {
  it('parseChartSeries reads labels and datasets', () => {
    const data = parseChartSeries('labels: [Q1, Q2]\ndatasets:\n  - name: 营收\n    data: [1, 2.5]');
    expect(data.labels).toEqual(['Q1', 'Q2']);
    expect(data.datasets).toEqual([{ name: '营收', data: [1, 2.5] }]);
  });

  it('validateAnimatedOutput flags missing chrome and stray CDNs', () => {
    const bad = '<html data-template="kai-report-creator" data-version="2.0.0" data-theme="x" data-render-mode="animated" data-animation="scrollytelling"><body></body></html>';
    const r = validateAnimatedOutput(bad, 'scrollytelling', '2.0.0');
    expect(r.chromeFindings.some(f => f.includes('data-theme'))).toBe(true);
    expect(r.chromeFindings.some(f => f.includes('play-btn'))).toBe(true);
    expect(r.chromeFindings.some(f => f.includes('allow-list'))).toBe(true);
    expect(r.kpiFindings.some(f => f.includes('report-summary'))).toBe(true);
  });

  it('validateAnimatedOutput rejects external scripts in iridescence', () => {
    const bad = '<html data-template="kai-report-creator" data-version="2.0.0" data-theme="iridescence" data-render-mode="animated" data-animation="iridescence"><head><script src="https://cdn.example/x.js"></script></head><body><button id="play-btn"></button><nav id="nav-sections"></nav><script>canvas.style.background="x";IntersectionObserver;</script><script type="application/json" id="report-summary">{"kpis":[{"value":"1"}]}</script></body></html>';
    const r = validateAnimatedOutput(bad, 'iridescence', '2.0.0');
    expect(r.chromeFindings.some(f => f.includes('zero-CDN'))).toBe(true);
  });
});
