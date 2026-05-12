import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::code block into syntax-highlighted HTML.
 * Uses highlight.js CDN for client-side highlighting.
 */
export declare function renderCode(block: IRBlock, options: RenderOptions): string;
