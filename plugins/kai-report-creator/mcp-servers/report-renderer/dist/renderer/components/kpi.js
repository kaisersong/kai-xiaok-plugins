import { escHtml } from '../escape.js';
/**
 * Render a :::kpi block into HTML.
 * Supports YAML items format:
 *   items:
 *     - label: X
 *       value: 100
 *       trend: +10%
 */
export function renderKpi(block, options) {
    const items = parseKpiItems(block.body);
    if (items.length === 0)
        return '<!-- empty kpi -->';
    const cols = getGridCols(items.length);
    const animClass = options.animations ? ' fade-in-up' : '';
    const cards = items.map((item, i) => {
        const trendHtml = item.trend ? renderTrend(item.trend) : '';
        const stagger = options.animations ? ` style="animation-delay:${i * 80}ms"` : '';
        return `      <div class="kpi-card${animClass}"${stagger}>
        <div class="kpi-label">${escHtml(item.label)}</div>
        <div class="kpi-value" data-target-value="${escHtml(item.value)}">${escHtml(item.value)}</div>
        ${trendHtml}
      </div>`;
    }).join('\n');
    return `    <div class="kpi-grid" style="grid-template-columns:repeat(${cols},1fr)">\n${cards}\n    </div>`;
}
function parseKpiItems(body) {
    const items = [];
    const lines = body.split('\n');
    let current = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- label:') || trimmed.startsWith('-label:')) {
            if (current && current.label)
                items.push(current);
            current = { label: extractValue(trimmed, 'label') };
        }
        else if (current) {
            if (trimmed.startsWith('value:'))
                current.value = extractValue(trimmed, 'value');
            else if (trimmed.startsWith('trend:'))
                current.trend = extractValue(trimmed, 'trend');
            else if (trimmed.startsWith('status:'))
                current.status = extractValue(trimmed, 'status');
        }
    }
    if (current && current.label)
        items.push(current);
    return items;
}
function extractValue(line, key) {
    const match = line.match(new RegExp(`${key}:\\s*(.+)`));
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
}
function getGridCols(count) {
    if (count <= 2)
        return 2;
    if (count === 3)
        return 3;
    if (count === 4)
        return 2;
    return 3;
}
function renderTrend(trend) {
    const isUp = trend.startsWith('+');
    const isDown = trend.startsWith('-');
    const cls = isUp ? 'up' : isDown ? 'down' : 'flat';
    return `        <div class="kpi-delta kpi-delta--${cls}">${escHtml(trend)}</div>`;
}
//# sourceMappingURL=kpi.js.map