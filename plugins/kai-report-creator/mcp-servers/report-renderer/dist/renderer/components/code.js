import { escHtml } from '../escape.js';
/**
 * Render a :::code block into syntax-highlighted HTML.
 * Uses highlight.js CDN for client-side highlighting.
 */
export function renderCode(block, options) {
    const lang = block.params['lang'] ?? '';
    const title = block.params['title'] ?? '';
    const animClass = options.animations ? ' fade-in-up' : '';
    const codeContent = escHtml(block.body.trim());
    const langClass = lang ? ` class="language-${lang}"` : '';
    const titleHtml = title ? `\n              <div class="code-title">${escHtml(title)}</div>` : '';
    return `          <div data-component="code" class="code-wrapper${animClass}">${titleHtml}
            <pre><code${langClass}>${codeContent}</code></pre>
          </div>`;
}
//# sourceMappingURL=code.js.map