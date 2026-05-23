/**
 * Shared HTML escape utilities for component renderers.
 *
 * - escHtml(): full escape — for attribute values, code content, structured data
 * - escHtmlText(): text-node escape — keeps quotes readable while escaping HTML syntax
 * - escHtmlPreserveInline(): preserves whitelisted inline HTML tags (badge, strong, em, etc.)
 *   — for prose-like content in table cells, list items, callouts, timelines
 */
/** Full HTML escape — use for attributes and structured data (kpi values, code, diagram YAML). */
export declare function escHtml(s: string): string;
/** Escape text-node content. Quotes are safe in text nodes and should remain readable. */
export declare function escHtmlText(s: string): string;
/**
 * Escape HTML but preserve whitelisted inline tags.
 * Use for table cells, list items, callout body, timeline content.
 */
export declare function escHtmlPreserveInline(s: string): string;
