import type { IRDocument } from '../parser/ir-parser.js';
export interface QualityHint {
    section_index: number;
    heading: string;
    rule: string;
    message: string;
}
/**
 * Content quality checks — moved from SKILL.md to programmatic validation.
 * Returns hints (non-blocking suggestions) rather than hard errors.
 */
export declare function checkContentQuality(doc: IRDocument): QualityHint[];
