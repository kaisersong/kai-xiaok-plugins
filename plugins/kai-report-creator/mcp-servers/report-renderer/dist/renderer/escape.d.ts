/**
 * Shared HTML escape utilities for component renderers.
 *
 * - escHtml(): full escape — for attribute values, code content, structured data
 * - escHtmlPreserveInline(): preserves whitelisted inline HTML tags (badge, strong, em, etc.)
 *   — for prose-like content in table cells, list items, callouts, timelines
 */
/** Full HTML escape — use for attributes and structured data (kpi values, code, diagram YAML). */
export declare function escHtml(s: string): string;
/**
 * Escape HTML but preserve whitelisted inline tags.
 * Use for table cells, list items, callout body, timeline content.
 */
export declare function escHtmlPreserveInline(s: string): string;
