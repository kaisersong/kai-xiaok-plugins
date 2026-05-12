import type { IRBlock } from '../parser/ir-parser.js';
export interface RenderOptions {
    theme: string;
    lang: string;
    animations: boolean;
}
export interface ComponentRenderer {
    render(block: IRBlock, options: RenderOptions): string;
}
