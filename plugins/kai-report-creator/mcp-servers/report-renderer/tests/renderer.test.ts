import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from '../src/renderer/html-builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

const validIR = readFileSync(join(fixturesDir, 'valid-mixed.report.md'), 'utf-8');

describe('renderReport', () => {
  const outputPath = join(__dirname, 'output-test.html');

  afterAll(() => {
    if (existsSync(outputPath)) unlinkSync(outputPath);
  });

  it('should render valid IR to HTML successfully', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.success).toBe(true);
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('data-template="kai-report-creator"');
  });

  it('should pass L0 validation (no ::: leakage, has ir-hash)', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.validation.l0).toBe(true);
    expect(result.html).toMatch(/meta\s+name="ir-hash"\s+content="[a-f0-9]+"/);
  });

  it('should pass L1 validation (shell structure)', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.validation.l1).toBe(true);
    expect(result.html).toContain('report-wrapper');
    expect(result.html).toContain('<script');
  });

  it('should pass L2 validation (required IDs)', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.validation.l2).toBe(true);
    const requiredIds = [
      'toc-toggle-btn', 'toc-sidebar', 'card-mode-btn',
      'sc-overlay', 'export-btn', 'export-menu',
      'export-print', 'export-png-desktop', 'export-png-mobile',
      'export-im-share', 'report-summary',
    ];
    for (const id of requiredIds) {
      expect(result.html).toContain(`id="${id}"`);
    }
  });

  it('should render KPI component correctly', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.html).toContain('kpi-grid');
    expect(result.html).toContain('kpi-card');
    expect(result.html).toContain('月活用户');
    expect(result.html).toContain('+23%');
  });

  it('should render table component correctly', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.html).toContain('report-table');
    expect(result.html).toContain('AI 个性化推荐');
  });

  it('should render callout component correctly', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.html).toContain('callout callout--tip');
    expect(result.html).toContain('基础设施成本下降');
  });

  it('should include TOC sidebar with sections', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.html).toContain('toc-sidebar');
    expect(result.html).toContain('核心指标');
    expect(result.html).toContain('增长趋势');
  });

  it('should include ECharts CDN when chart block present', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.html).toContain('echarts.min.js');
  });

  it('should write HTML file to output path', () => {
    renderReport({ irContent: validIR, outputPath });
    expect(existsSync(outputPath)).toBe(true);
    const content = readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
  });

  it('should report correct stats', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    expect(result.stats.sections).toBeGreaterThanOrEqual(4);
    expect(result.stats.components).toBeGreaterThanOrEqual(4);
    expect(result.stats.cssBytes).toBeGreaterThan(0);
    expect(result.stats.htmlBytes).toBeGreaterThan(1000);
  });

  it('should support theme override', () => {
    const result = renderReport({ irContent: validIR, outputPath, themeOverride: 'dark-tech' });
    expect(result.success).toBe(true);
  });

  it('should have no warnings for valid IR', () => {
    const result = renderReport({ irContent: validIR, outputPath });
    // May have warnings about file write, but no validation warnings
    const validationWarnings = result.warnings.filter(w => w.includes('validation'));
    expect(validationWarnings).toHaveLength(0);
  });

  it('fails output validation when KPI values are status text instead of numbers', () => {
    const invalidKpiIR = `---
title: KPI Gate Test
theme: corporate-blue
lang: zh
report_class: mixed
date: 2026-05-17
---

## 核心指标

:::kpi
items:
  - label: 项目状态
    value: 完成
    trend: 状态值
:::

这个指标应该被拒绝，因为 KPI value 不是可量化数字。
`;
    const result = renderReport({ irContent: invalidKpiIR, outputPath });
    expect(result.success).toBe(false);
    expect(result.warnings.some(w => w.includes('KPI') || w.includes('kpi'))).toBe(true);
  });
});
