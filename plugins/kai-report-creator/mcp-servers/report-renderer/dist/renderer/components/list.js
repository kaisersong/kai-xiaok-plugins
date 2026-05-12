import { escHtmlPreserveInline } from '../escape.js';
/**
 * Render a :::list block into HTML.
 */
export function renderList(block, options) {
    const style = block.params['style'] ?? 'unordered';
    const items = block.body.trim().split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
    if (items.length === 0)
        return '<!-- empty list -->';
    const tag = style === 'ordered' ? 'ol' : 'ul';
    const animClass = options.animations ? ' fade-in-up' : '';
    const lis = items.map(item => `      <li>${escHtmlPreserveInline(item)}</li>`).join('\n');
    return `    <${tag} class="report-list styled-list${animClass}">\n${lis}\n    </${tag}>`;
}
//# sourceMappingURL=list.js.map