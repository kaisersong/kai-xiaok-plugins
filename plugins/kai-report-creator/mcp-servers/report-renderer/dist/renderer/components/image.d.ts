import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::image block into an HTML figure.
 */
export declare function renderImage(block: IRBlock, options: RenderOptions): string;
