/**
 * Shared HTML escape utilities for component renderers.
 *
 * - escHtml(): full escape — for attribute values, code content, structured data
 * - escHtmlText(): text-node escape — keeps quotes readable while escaping HTML syntax
 * - escHtmlPreserveInline(): preserves whitelisted inline HTML tags (badge, strong, em, etc.)
 *   — for prose-like content in table cells, list items, callouts, timelines
 */

/** Full HTML escape — use for attributes and structured data (kpi values, code, diagram YAML). */
export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Escape text-node content. Quotes are safe in text nodes and should remain readable. */
export function escHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Allowed inline HTML tags that IR authors can use in prose-like content.
 * These are preserved during escaping; everything else is escaped.
 */
const ALLOWED_TAGS = [
  'span', 'strong', 'em', 'b', 'i', 'code', 'mark', 'sub', 'sup', 'br',
];

const ALLOWED_TAG_RE = new RegExp(
  `<(/?(${ALLOWED_TAGS.join('|')})(\\s[^>]*)?)>`, 'gi'
);

/**
 * Escape HTML but preserve whitelisted inline tags.
 * Use for table cells, list items, callout body, timeline content.
 */
export function escHtmlPreserveInline(s: string): string {
  // 1. Temporarily replace allowed tags with placeholders
  const placeholders: string[] = [];
  const withPlaceholders = s.replace(ALLOWED_TAG_RE, (match) => {
    placeholders.push(match);
    return `\x00PH${placeholders.length - 1}\x00`;
  });

  // 2. Escape text-node syntax while keeping normal quotation marks readable.
  const escaped = escHtmlText(withPlaceholders);

  // 3. Restore placeholders
  return escaped.replace(/\x00PH(\d+)\x00/g, (_, idx) => placeholders[Number(idx)]!);
}
