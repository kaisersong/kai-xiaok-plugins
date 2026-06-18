import type { IRFrontmatter } from '../parser/frontmatter.js';

export interface JsonLdInput {
  frontmatter: IRFrontmatter;
  irHash: string;
  rendererVersion: string;
}

export function buildReportJsonLd(input: JsonLdInput): string {
  const fm = input.frontmatter;
  const payload: Record<string, unknown> = {
    '@context': 'http://schema.org/',
    '@type': 'Report',
  };

  if (input.irHash) {
    payload['@id'] = `https://kai.app/id/report/${encodeURIComponent(input.irHash)}`;
  }

  payload.name = fm.title || 'Report';
  if (fm.abstract) payload.description = fm.abstract;
  if (fm.date) payload.dateCreated = fm.date;
  payload.inLanguage = fm.lang === 'en' ? 'en-US' : 'zh-CN';

  payload.creator = fm.author
    ? { '@type': 'Person', name: fm.author }
    : { '@type': 'Organization', name: 'kai-report-creator' };

  if (fm.audience) {
    payload.audience = { '@type': 'Audience', name: fm.audience };
  }
  if (fm.decision_goal) {
    payload.about = { '@type': 'Thing', name: fm.decision_goal };
  }
  if (fm.report_class) payload.genre = fm.report_class;
  if (fm.archetype) {
    payload.additionalType = `https://kai.app/ns#report-archetype-${encodeURIComponent(fm.archetype)}`;
  }

  const additionalProperty: Array<Record<string, string>> = [];
  if (fm.theme) additionalProperty.push(propertyValue('reportTheme', fm.theme));
  if (fm.template) additionalProperty.push(propertyValue('reportTemplate', fm.template));
  if (input.rendererVersion) additionalProperty.push(propertyValue('rendererVersion', input.rendererVersion));
  if (input.irHash) additionalProperty.push(propertyValue('irHash', input.irHash));
  additionalProperty.push(propertyValue('metadataVersion', '1'));
  payload.additionalProperty = additionalProperty;

  return stableStringify(payload);
}

function propertyValue(propertyName: string, value: string): Record<string, string> {
  return {
    '@type': 'PropertyValue',
    propertyID: `https://kai.app/ns#${propertyName}`,
    value,
  };
}

function stableStringify(value: unknown, indent = 2): string {
  return JSON.stringify(
    value,
    (_key, val) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(val as Record<string, unknown>).sort()) {
          sorted[k] = (val as Record<string, unknown>)[k];
        }
        return sorted;
      }
      return val;
    },
    indent,
  );
}

export function escapeJsonLdForHtml(jsonString: string): string {
  return String(jsonString)
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
