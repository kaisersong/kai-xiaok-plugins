import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::chart block into HTML with ECharts initialization.
 * Supports: bar, line, pie, radar, scatter, funnel, sankey
 */
export declare function renderChart(block: IRBlock, options: RenderOptions): string;
