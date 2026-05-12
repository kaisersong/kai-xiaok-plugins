import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
/**
 * Render a :::diagram block into inline SVG.
 * Supports: sequence, flowchart, tree, mindmap
 */
export declare function renderDiagram(block: IRBlock, options: RenderOptions): string;
