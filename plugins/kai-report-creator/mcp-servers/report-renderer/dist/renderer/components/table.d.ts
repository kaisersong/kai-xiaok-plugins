import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::table block into HTML.
 * Body is a Markdown table.
 */
export declare function renderTable(block: IRBlock, options: RenderOptions): string;
