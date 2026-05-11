import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
import { escHtml } from '../escape.js';

/**
 * Render a :::image block into an HTML figure.
 */
export function renderImage(block: IRBlock, options: RenderOptions): string {
  const src = block.params['src'] ?? '';
  const alt = block.params['alt'] ?? '';
  const caption = block.params['caption'] ?? block.body.trim();
  const width = block.params['width'] ?? '';
  const animClass = options.animations ? ' fade-in-up' : '';

  if (!src) return '<!-- image: no src specified -->';

  const widthAttr = width ? ` style="max-width:${escHtml(width)}"` : '';
  const captionHtml = caption ? `\n            <figcaption>${escHtml(caption)}</figcaption>` : '';

  return `          <figure data-component="image" class="report-image${animClass}"${widthAttr}>
            <img src="${escHtml(src)}" alt="${escHtml(alt)}" loading="lazy">${captionHtml}
          </figure>`;
}

