import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
import { escHtmlPreserveInline } from '../escape.js';

/**
 * Render a :::callout block into HTML.
 */
export function renderCallout(block: IRBlock, options: RenderOptions): string {
  const type = block.params['type'] ?? 'note';
  const body = block.body.trim();
  const animClass = options.animations ? ' fade-in-up' : '';

  const icons: Record<string, string> = {
    note: 'ℹ️',
    tip: '💡',
    warning: '⚠️',
    danger: '🚨',
  };

  const icon = icons[type] ?? icons['note']!;

  return `    <div class="callout callout--${type}${animClass}">
      <span class="callout-icon">${icon}</span>
      <div class="callout-content">${escHtmlPreserveInline(body)}</div>
    </div>`;
}
