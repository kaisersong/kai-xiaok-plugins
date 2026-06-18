import { describe, it, expect } from 'vitest';
import { buildReportJsonLd, escapeJsonLdForHtml } from '../src/renderer/jsonld.js';
import type { IRFrontmatter } from '../src/parser/frontmatter.js';

function makeFrontmatter(overrides: Partial<IRFrontmatter> = {}): IRFrontmatter {
  return {
    title: '测试报告',
    theme: 'corporate-blue',
    date: '2026-06-17',
    lang: 'zh',
    report_class: 'mixed',
    ...overrides,
  };
}

const ALLOWED_IRI_PREFIXES = [
  'http://schema.org/',
  'https://schema.org/',
  'https://kai.app/',
];

function isAllowedIri(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  if (!value.includes(':')) return true;
  return ALLOWED_IRI_PREFIXES.some(p => value.startsWith(p));
}

function collectPropertyIds(obj: unknown, ids: string[] = []): string[] {
  if (Array.isArray(obj)) {
    for (const item of obj) collectPropertyIds(item, ids);
  } else if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (typeof o.propertyID === 'string') ids.push(o.propertyID);
    for (const v of Object.values(o)) collectPropertyIds(v, ids);
  }
  return ids;
}

function collectAtIds(obj: unknown, ids: string[] = []): string[] {
  if (Array.isArray(obj)) {
    for (const item of obj) collectAtIds(item, ids);
  } else if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (typeof o['@id'] === 'string') ids.push(o['@id']);
    for (const v of Object.values(o)) collectAtIds(v, ids);
  }
  return ids;
}

describe('buildReportJsonLd', () => {
  it('#1 完整 frontmatter → JSON-LD 全字段映射', () => {
    const fm = makeFrontmatter({
      title: 'Q2 销售分析',
      author: '张三',
      date: '2026-06-17',
      lang: 'zh',
      abstract: '本季度销售同比增长 18%',
      audience: '管理层',
      report_class: 'data',
      archetype: 'research',
      decision_goal: 'Q3 资源分配',
      theme: 'corporate-blue',
      template: 'standard',
    });
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'a1b2c3d4', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj['@context']).toBe('http://schema.org/');
    expect(obj['@type']).toBe('Report');
    expect(obj['@id']).toBe('https://kai.app/id/report/a1b2c3d4');
    expect(obj.name).toBe('Q2 销售分析');
    expect(obj.description).toBe('本季度销售同比增长 18%');
    expect(obj.dateCreated).toBe('2026-06-17');
    expect(obj.inLanguage).toBe('zh-CN');
    expect(obj.creator).toEqual({ '@type': 'Person', name: '张三' });
    expect(obj.audience).toEqual({ '@type': 'Audience', name: '管理层' });
    expect(obj.about).toEqual({ '@type': 'Thing', name: 'Q3 资源分配' });
    expect(obj.genre).toBe('data');
    expect(obj.additionalType).toBe('https://kai.app/ns#report-archetype-research');
  });

  it('#2 author 缺失 → creator 退化为 Organization', () => {
    const fm = makeFrontmatter();
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj.creator).toEqual({ '@type': 'Organization', name: 'kai-report-creator' });
  });

  it('#2b abstract / audience / decision_goal 缺失 → 各自省略', () => {
    const fm = makeFrontmatter();
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj.description).toBeUndefined();
    expect(obj.audience).toBeUndefined();
    expect(obj.about).toBeUndefined();
  });

  it('#2c archetype 缺失 → additionalType 省略', () => {
    const fm = makeFrontmatter();
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj.additionalType).toBeUndefined();
  });

  it('#2d irHash 缺失 → @id 省略，对应 PropertyValue 也省略', () => {
    const fm = makeFrontmatter();
    const out = buildReportJsonLd({ frontmatter: fm, irHash: '', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj['@id']).toBeUndefined();
    const irHashProp = obj.additionalProperty.find(
      (p: any) => p.propertyID === 'https://kai.app/ns#irHash'
    );
    expect(irHashProp).toBeUndefined();
  });

  it('#3 lang 转换 zh→zh-CN, en→en-US', () => {
    const zhOut = buildReportJsonLd({ frontmatter: makeFrontmatter({ lang: 'zh' }), irHash: 'h', rendererVersion: '2.1.0' });
    expect(JSON.parse(zhOut).inLanguage).toBe('zh-CN');
    const enOut = buildReportJsonLd({ frontmatter: makeFrontmatter({ lang: 'en' }), irHash: 'h', rendererVersion: '2.1.0' });
    expect(JSON.parse(enOut).inLanguage).toBe('en-US');
  });

  it('#4 archetype 用完整 URL（不是裸字符串）', () => {
    const fm = makeFrontmatter({ archetype: 'comparison' });
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj.additionalType).toBe('https://kai.app/ns#report-archetype-comparison');
    // negative: 不能是裸 'comparison'
    expect(obj.additionalType).not.toBe('comparison');
  });

  it('#5 must_include 不映射到 keywords（v1.1 修正）', () => {
    const fm = makeFrontmatter({ must_include: ['竞品分析', '风险评估'] });
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj.keywords).toBeUndefined();
  });

  it('#5b must_avoid 也不映射', () => {
    const fm = makeFrontmatter({ must_avoid: ['过时数据', '未审核来源'] });
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj.keywords).toBeUndefined();
  });

  it('#6 嵌套字段完整性：additionalProperty[].propertyID/value 都存在', () => {
    const fm = makeFrontmatter({ theme: 'minimal', template: 'standard' });
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'a1b2c3d4', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(Array.isArray(obj.additionalProperty)).toBe(true);
    for (const ap of obj.additionalProperty) {
      expect(ap['@type']).toBe('PropertyValue');
      expect(typeof ap.propertyID).toBe('string');
      expect(typeof ap.value).toBe('string');
    }
    const propertyIDs = obj.additionalProperty.map((p: any) => p.propertyID);
    expect(propertyIDs).toContain('https://kai.app/ns#reportTheme');
    expect(propertyIDs).toContain('https://kai.app/ns#reportTemplate');
    expect(propertyIDs).toContain('https://kai.app/ns#rendererVersion');
    expect(propertyIDs).toContain('https://kai.app/ns#irHash');
    expect(propertyIDs).toContain('https://kai.app/ns#metadataVersion');
  });

  it('#7 幂等：同输入两次调用 byte-identical', () => {
    const fm = makeFrontmatter({ author: 'A', abstract: 'X' });
    const a = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    const b = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    expect(a).toBe(b);
  });

  it('#8 </script> escaping', () => {
    const raw = JSON.stringify({ name: 'evil </script><img>' });
    const escaped = escapeJsonLdForHtml(raw);
    expect(escaped).not.toContain('</script>');
    expect(escaped).toContain('<\\/script>');
  });

  it('#9 U+2028/U+2029 escaping', () => {
    const raw = `{"a":"line1\u2028line2\u2029line3"}`;
    const escaped = escapeJsonLdForHtml(raw);
    expect(escaped).not.toContain('\u2028');
    expect(escaped).not.toContain('\u2029');
    expect(escaped).toContain('\\u2028');
    expect(escaped).toContain('\\u2029');
  });

  it('#10 schema.org IRI whitelist (recursive)', () => {
    const fm = makeFrontmatter({
      author: '张三', abstract: 'X', audience: 'Y', archetype: 'brief',
      theme: 'minimal', template: 'std',
    });
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'h', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(isAllowedIri(obj['@context'])).toBe(true);
    for (const pid of collectPropertyIds(obj)) {
      expect(isAllowedIri(pid)).toBe(true);
    }
    for (const id of collectAtIds(obj)) {
      expect(isAllowedIri(id)).toBe(true);
    }
  });

  it('#11 irHash URL encoding: 特殊字符正确编码', () => {
    const fm = makeFrontmatter();
    const out = buildReportJsonLd({ frontmatter: fm, irHash: 'a/b c#d', rendererVersion: '2.1.0' });
    const obj = JSON.parse(out);
    expect(obj['@id']).toBe('https://kai.app/id/report/a%2Fb%20c%23d');
  });

  it('#17 creator type: 有 author → Person；无 author → Organization', () => {
    const withAuthor = JSON.parse(
      buildReportJsonLd({ frontmatter: makeFrontmatter({ author: '张三' }), irHash: 'h', rendererVersion: '2.1.0' })
    );
    expect(withAuthor.creator['@type']).toBe('Person');
    const noAuthor = JSON.parse(
      buildReportJsonLd({ frontmatter: makeFrontmatter(), irHash: 'h', rendererVersion: '2.1.0' })
    );
    expect(noAuthor.creator['@type']).toBe('Organization');
  });
});

describe('escapeJsonLdForHtml', () => {
  it('case-insensitive </script> escape', () => {
    const raw = JSON.stringify({ x: '</Script>' });
    const escaped = escapeJsonLdForHtml(raw);
    expect(/<\/[sS]cript>/.test(escaped)).toBe(false);
  });
});
