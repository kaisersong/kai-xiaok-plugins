import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::list block into HTML.
 */
export declare function renderList(block: IRBlock, options: RenderOptions): string;
