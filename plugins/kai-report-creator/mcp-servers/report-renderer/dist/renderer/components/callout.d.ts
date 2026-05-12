import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::callout block into HTML.
 */
export declare function renderCallout(block: IRBlock, options: RenderOptions): string;
