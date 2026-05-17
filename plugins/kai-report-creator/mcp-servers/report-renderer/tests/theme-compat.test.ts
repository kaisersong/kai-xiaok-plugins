import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTheme, assembleCSS, getBuiltinThemes } from '../src/themes/loader.js';
import { renderReport } from '../src/renderer/html-builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const validIR = readFileSync(join(fixturesDir, 'valid-mixed.report.md'), 'utf-8');

describe('Theme CSS loading and assembly', () => {
  const themes = getBuiltinThemes();

  it('should load all 8 builtin themes shared with standalone report-creator', () => {
    expect(themes).toEqual([
      'corporate-blue',
      'minimal',
      'dark-tech',
      'dark-board',
      'data-story',
      'newspaper',
      'regular-lumen',
      'fangsong',
    ]);
    for (const name of themes) {
      const theme = loadTheme(name);
      expect(theme.name).toBe(name);
      expect(theme.themeCSS.length).toBeGreaterThan(100);
      expect(theme.sharedCSS.length).toBeGreaterThan(100);
    }
  });

  it('should fallback to corporate-blue for unknown themes', () => {
    const theme = loadTheme('nonexistent-theme');
    expect(theme.name).toBe('corporate-blue');
  });

  describe('CSS assembly order: base → shared → post-shared', () => {
    const themesWithPostShared = ['dark-board', 'data-story', 'newspaper', 'regular-lumen', 'fangsong'];

    for (const name of themesWithPostShared) {
      it(`${name}: POST-SHARED OVERRIDE comes after shared.css`, () => {
        const theme = loadTheme(name);
        const css = assembleCSS(theme);

        const sharedMarkerIdx = css.indexOf('/* Shared Component CSS');
        const postSharedIdx = css.indexOf('/* === POST-SHARED OVERRIDE');
        expect(sharedMarkerIdx).toBeGreaterThan(-1);
        expect(postSharedIdx).toBeGreaterThan(-1);
        expect(postSharedIdx).toBeGreaterThan(sharedMarkerIdx);
      });
    }

    it('corporate-blue: no POST-SHARED section, just base + shared', () => {
      const theme = loadTheme('corporate-blue');
      const css = assembleCSS(theme);
      expect(css).not.toContain('POST-SHARED OVERRIDE');
      expect(css).toContain('/* Shared Component CSS');
    });

    it('minimal: no POST-SHARED section, just base + shared', () => {
      const theme = loadTheme('minimal');
      const css = assembleCSS(theme);
      expect(css).not.toContain('POST-SHARED OVERRIDE');
    });
  });

  describe('dark themes override callout backgrounds', () => {
    it('dark-tech: callout--note uses dark background', () => {
      const theme = loadTheme('dark-tech');
      const css = assembleCSS(theme);
      // The last occurrence of callout--note should be the dark override
      const matches = [...css.matchAll(/\.callout--note\s*\{[^}]+\}/g)];
      expect(matches.length).toBeGreaterThanOrEqual(2);
      const lastMatch = matches[matches.length - 1]![0];
      expect(lastMatch).toContain('#1E293B');
    });

    it('dark-board: callout--note uses dark background', () => {
      const theme = loadTheme('dark-board');
      const css = assembleCSS(theme);
      const matches = [...css.matchAll(/\.callout--note\s*\{[^}]+\}/g)];
      expect(matches.length).toBeGreaterThanOrEqual(2);
      const lastMatch = matches[matches.length - 1]![0];
      expect(lastMatch).toContain('#161B22');
    });
  });

  describe('dark themes override summary card for visibility', () => {
    for (const name of ['dark-tech', 'dark-board']) {
      it(`${name}: .sc-card uses var(--surface) background`, () => {
        const theme = loadTheme(name);
        const css = assembleCSS(theme);
        // Last .sc-card rule should reference var(--surface)
        const matches = [...css.matchAll(/\.sc-card\s*\{[^}]+\}/g)];
        const lastMatch = matches[matches.length - 1]![0];
        expect(lastMatch).toContain('var(--surface)');
      });

      it(`${name}: .sc-close uses light text color`, () => {
        const theme = loadTheme(name);
        const css = assembleCSS(theme);
        const matches = [...css.matchAll(/\.sc-close\s*\{[^}]+\}/g)];
        const lastMatch = matches[matches.length - 1]![0];
        expect(lastMatch).toContain('var(--text)');
      });
    }
  });

  it('theme_overrides append as :root variables at the end', () => {
    const theme = loadTheme('corporate-blue');
    const css = assembleCSS(theme, { '--primary': '#ff0000', '--bg': '#000000' });
    const rootIdx = css.lastIndexOf(':root {');
    expect(rootIdx).toBeGreaterThan(-1);
    const rootBlock = css.slice(rootIdx);
    expect(rootBlock).toContain('--primary: #ff0000');
    expect(rootBlock).toContain('--bg: #000000');
  });
});

describe('All themes render successfully with full validation', () => {
  const themes = getBuiltinThemes();
  const outputPath = join(__dirname, 'output-theme-compat.html');

  for (const theme of themes) {
    describe(`theme: ${theme}`, () => {
      it('renders with L0/L1/L2 all passing', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.success).toBe(true);
        expect(result.validation.l0).toBe(true);
        expect(result.validation.l1).toBe(true);
        expect(result.validation.l2).toBe(true);
      });

      it('contains all 15 required element IDs', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        const requiredIds = [
          'edit-hotzone', 'edit-toggle', 'sc-card', 'sc-close',
          'toc-toggle-btn', 'toc-sidebar', 'card-mode-btn',
          'sc-overlay', 'export-btn', 'export-menu',
          'export-print', 'export-png-desktop', 'export-png-mobile',
          'export-im-share', 'report-summary',
        ];
        for (const id of requiredIds) {
          expect(result.html, `missing id="${id}" in ${theme}`).toContain(`id="${id}"`);
        }
      });

      it('contains meta generator tag with theme name', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toContain(`<meta name="generator" content="kai-report-creator ${theme} v2.0.0">`);
      });

      it('contains html2canvas preload script', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toContain('html2canvas');
      });

      it('contains summary card with poster layout JS', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toContain('splitPosterTitle');
        expect(result.html).toContain('sc-kpi-row');
      });

      it('contains KPI counter animation JS', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toContain('data-target-value');
        expect(result.html).toContain('requestAnimationFrame');
      });

      it('contains edit mode JS with hotzone', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toContain('edit-hotzone');
        expect(result.html).toContain('contenteditable');
      });

      it('contains TOC with h4 heading and data-section links', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toMatch(/<h4>.*<\/h4>/);
        expect(result.html).toContain('data-section=');
      });

      it('contains export menu with .export-item class', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toContain('class="export-item"');
      });

      it('CSS contains theme variables (:root)', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toContain('--primary:');
        expect(result.html).toContain('--bg:');
        expect(result.html).toContain('--surface:');
      });

      it('CSS contains shared component styles', () => {
        const result = renderReport({ irContent: validIR, outputPath, themeOverride: theme });
        expect(result.html).toContain('.kpi-grid');
        expect(result.html).toContain('.export-item');
        expect(result.html).toContain('.sc-overlay');
        expect(result.html).toContain('.edit-hotzone');
      });
    });
  }
});

describe('Prose cadence blocks use theme-aware backgrounds', () => {
  it('shared.css uses var(--surface) not hardcoded rgba for .lead-block', () => {
    const theme = loadTheme('dark-tech');
    const css = assembleCSS(theme);
    // Find .lead-block rule
    const match = css.match(/\.lead-block\s*\{[^}]+\}/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('var(--surface)');
    expect(match![0]).not.toContain('rgba(255,255,255');
  });

  it('shared.css uses var(--surface) not hardcoded rgba for .action-card', () => {
    const theme = loadTheme('dark-board');
    const css = assembleCSS(theme);
    const match = css.match(/\.action-card\s*\{[^}]+\}/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('var(--surface)');
    expect(match![0]).not.toContain('rgba(255,255,255');
  });
});
