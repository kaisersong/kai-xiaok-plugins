import { describe, it, expect } from 'vitest';
import { buildHtmlShell, ShellOptions } from '../src/renderer/shell.js';

function makeOpts(overrides: Partial<ShellOptions> = {}): ShellOptions {
  return {
    title: 'Test Report',
    theme: 'corporate-blue',
    lang: 'zh',
    css: ':root { --primary: #000; }',
    needsEcharts: false,
    needsHighlightjs: false,
    toc: true,
    animations: true,
    irHash: 'abc123',
    reportSummaryJson: '{"title":"Test","theme":"corporate-blue"}',
    bodyContent: '<section data-section="核心指标"><h2>核心指标</h2></section>',
    tocItems: [
      { slug: 'core', text: '核心指标', level: 2 },
      { slug: 'sub', text: '子指标', level: 3 },
    ],
    author: '测试作者',
    date: '2026-05-10',
    abstract: '测试摘要',
    version: '2.0.0',
    ...overrides,
  };
}

describe('buildHtmlShell', () => {
  it('produces valid HTML5 document', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  it('includes meta generator with theme and version', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toContain('<meta name="generator" content="kai-report-creator corporate-blue v2.0.0">');
  });

  it('includes data-template and data-version on html tag', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toContain('data-template="kai-report-creator"');
    expect(html).toContain('data-version="2.0.0"');
    expect(html).toContain('data-theme="corporate-blue"');
  });

  it('includes edit-hotzone and edit-toggle elements', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toContain('id="edit-hotzone"');
    expect(html).toContain('id="edit-toggle"');
    expect(html).toContain('class="edit-hotzone"');
    expect(html).toContain('class="edit-toggle"');
  });

  it('includes export menu with .export-item buttons', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toContain('class="export-item"');
    expect(html).toContain('id="export-print"');
    expect(html).toContain('id="export-png-desktop"');
    expect(html).toContain('id="export-png-mobile"');
    expect(html).toContain('id="export-im-share"');
  });

  it('includes card-mode button with i18n text (zh)', () => {
    const html = buildHtmlShell(makeOpts({ lang: 'zh' }));
    expect(html).toContain('⊞ 摘要卡');
    expect(html).toContain('id="card-mode-btn"');
    expect(html).toContain('class="card-mode-btn"');
  });

  it('includes card-mode button with i18n text (en)', () => {
    const html = buildHtmlShell(makeOpts({ lang: 'en' }));
    expect(html).toContain('⊞ Summary');
  });

  it('includes export button text i18n (zh)', () => {
    const html = buildHtmlShell(makeOpts({ lang: 'zh' }));
    expect(html).toContain('🖨 打印 / PDF');
    expect(html).toContain('🖥 保存图片（桌面）');
    expect(html).toContain('📱 保存图片（手机）');
    expect(html).toContain('💬 IM 长图');
  });

  it('includes export button text i18n (en)', () => {
    const html = buildHtmlShell(makeOpts({ lang: 'en' }));
    expect(html).toContain('🖨 Print / PDF');
    expect(html).toContain('🖥 Desktop PNG');
    expect(html).toContain('📱 Mobile PNG');
    expect(html).toContain('💬 IM Share');
  });

  it('includes summary card structure', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toContain('id="sc-overlay"');
    expect(html).toContain('id="sc-card"');
    expect(html).toContain('id="sc-close"');
    expect(html).toContain('class="sc-overlay"');
    expect(html).toContain('class="sc-card"');
    expect(html).toContain('class="sc-close"');
  });

  it('includes report-meta with author and date', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toContain('class="report-meta"');
    expect(html).toContain('测试作者');
    expect(html).toContain('2026-05-10');
  });

  it('omits report-meta when no author and no date', () => {
    const html = buildHtmlShell(makeOpts({ author: '', date: '' }));
    expect(html).not.toContain('class="report-meta"');
  });

  it('includes report-footer with version and theme', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toContain('class="report-footer"');
    expect(html).toContain('kai-report-creator v2.0.0 corporate-blue');
  });

  it('includes hidden watermark div', () => {
    const html = buildHtmlShell(makeOpts());
    expect(html).toContain('data-watermark="kai-report-creator v2.0.0 corporate-blue"');
  });

  describe('TOC sidebar', () => {
    it('uses h4 heading element', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toMatch(/<h4>目录<\/h4>/);
    });

    it('uses data-section attribute on links', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toContain('data-section="核心指标"');
      expect(html).toContain('data-section="子指标"');
    });

    it('applies toc-h3 class to level-3 items', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toContain('class="toc-h3"');
    });

    it('uses aria-label and aria-expanded on toggle', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toContain('aria-label="目录"');
      expect(html).toContain('aria-expanded="false"');
    });

    it('uses "Contents" label for English', () => {
      const html = buildHtmlShell(makeOpts({ lang: 'en' }));
      expect(html).toMatch(/<h4>Contents<\/h4>/);
      expect(html).toContain('aria-label="Table of Contents"');
    });

    it('omits TOC when toc=false', () => {
      const html = buildHtmlShell(makeOpts({ toc: false }));
      // No actual TOC nav element rendered
      expect(html).not.toContain('<nav class="toc-sidebar"');
      expect(html).not.toContain('id="toc-toggle-btn"');
    });
  });

  describe('Scripts', () => {
    it('includes animation script when animations=true', () => {
      const html = buildHtmlShell(makeOpts({ animations: true }));
      expect(html).toContain('fadeObserver');
      expect(html).toContain('staggerGroup');
      expect(html).toContain('kpiObserver');
      expect(html).toContain('requestAnimationFrame');
    });

    it('omits animation script when animations=false', () => {
      const html = buildHtmlShell(makeOpts({ animations: false }));
      expect(html).not.toContain('fadeObserver');
      expect(html).not.toContain('staggerGroup');
    });

    it('includes TOC script when toc=true', () => {
      const html = buildHtmlShell(makeOpts({ toc: true }));
      expect(html).toContain('scheduleClose');
      expect(html).toContain('sectionObserver');
      expect(html).toContain('locked');
    });

    it('omits TOC script when toc=false', () => {
      const html = buildHtmlShell(makeOpts({ toc: false }));
      expect(html).not.toContain('scheduleClose');
    });

    it('always includes edit script', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toContain('edit-hotzone');
      expect(html).toContain('contenteditable');
      expect(html).toContain('edit-mode');
    });

    it('always includes export script with html2canvas', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toContain('html2canvas');
      expect(html).toContain('print-exporting');
      expect(html).toContain('loadLib');
    });

    it('always includes summary card script', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toContain('splitPosterTitle');
      expect(html).toContain('summaryCardLabel');
      expect(html).toContain('posterNoteText');
      expect(html).toContain('buildCard');
    });

    it('edit script supports Ctrl+S save', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toContain("e.key==='s'");
      expect(html).toContain('e.preventDefault()');
    });

    it('export script handles card-mode export', () => {
      const html = buildHtmlShell(makeOpts());
      expect(html).toContain('card-mode');
      expect(html).toContain('sc-card');
    });
  });

  describe('ECharts and Highlight.js CDN inclusion', () => {
    it('includes ECharts when needsEcharts=true', () => {
      const html = buildHtmlShell(makeOpts({ needsEcharts: true }));
      expect(html).toContain('echarts.min.js');
    });

    it('omits ECharts when needsEcharts=false', () => {
      const html = buildHtmlShell(makeOpts({ needsEcharts: false }));
      expect(html).not.toContain('echarts.min.js');
    });

    it('includes Highlight.js when needsHighlightjs=true', () => {
      const html = buildHtmlShell(makeOpts({ needsHighlightjs: true }));
      expect(html).toContain('highlight.min.js');
      expect(html).toContain('github.min.css');
    });
  });

  it('escapes HTML in title', () => {
    const html = buildHtmlShell(makeOpts({ title: '<script>alert("xss")</script>' }));
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes report-summary JSON block', () => {
    const html = buildHtmlShell(makeOpts({ reportSummaryJson: '{"title":"X","theme":"Y"}' }));
    expect(html).toContain('id="report-summary"');
    expect(html).toContain('{"title":"X","theme":"Y"}');
  });
});
