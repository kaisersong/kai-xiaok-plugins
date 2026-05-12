import { escHtml, escHtmlPreserveInline } from '../escape.js';
/**
 * Render a :::timeline block into HTML.
 * Item format: - Date: Description
 */
export function renderTimeline(block, options) {
    const items = parseTimelineItems(block.body);
    if (items.length === 0)
        return '<!-- empty timeline -->';
    const animClass = options.animations ? ' fade-in-up' : '';
    const itemsHtml = items.map((item, i) => {
        const stagger = options.animations ? ` style="animation-delay:${i * 100}ms"` : '';
        return `            <div class="timeline-item"${stagger}>
              <div class="timeline-date">${escHtml(item.date)}</div>
              <div class="timeline-dot"></div>
              <div class="timeline-content">${escHtmlPreserveInline(item.content)}</div>
            </div>`;
    }).join('\n');
    return `          <div data-component="timeline" class="timeline${animClass}">
${itemsHtml}
          </div>`;
}
function parseTimelineItems(body) {
    const items = [];
    const lines = body.trim().split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('-'))
            continue;
        const content = trimmed.slice(1).trim();
        // Match "Date: Description" pattern
        const match = content.match(/^(.+?):\s+(.+)$/);
        if (match) {
            items.push({ date: match[1].trim(), content: match[2].trim() });
        }
        else {
            items.push({ date: '', content });
        }
    }
    return items;
}
//# sourceMappingURL=timeline.js.map