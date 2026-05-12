import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::timeline block into HTML.
 * Item format: - Date: Description
 */
export declare function renderTimeline(block: IRBlock, options: RenderOptions): string;
