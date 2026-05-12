import { escHtmlPreserveInline } from '../escape.js';
/**
 * Render a :::callout block into HTML.
 */
export function renderCallout(block, options) {
    const type = block.params['type'] ?? 'note';
    const body = block.body.trim();
    const animClass = options.animations ? ' fade-in-up' : '';
    const icons = {
        note: 'ℹ️',
        tip: '💡',
        warning: '⚠️',
        danger: '🚨',
    };
    const icon = icons[type] ?? icons['note'];
    return `    <div class="callout callout--${type}${animClass}">
      <span class="callout-icon">${icon}</span>
      <div class="callout-content">${escHtmlPreserveInline(body)}</div>
    </div>`;
}
//# sourceMappingURL=callout.js.map