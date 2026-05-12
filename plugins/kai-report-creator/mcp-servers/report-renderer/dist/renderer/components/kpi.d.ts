import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::kpi block into HTML.
 * Supports YAML items format:
 *   items:
 *     - label: X
 *       value: 100
 *       trend: +10%
 */
export declare function renderKpi(block: IRBlock, options: RenderOptions): string;
