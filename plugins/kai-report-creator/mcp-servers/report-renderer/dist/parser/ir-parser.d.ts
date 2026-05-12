import { parseFrontmatter, type IRFrontmatter, type FrontmatterParseResult } from './frontmatter.js';
export interface IRBlock {
    tag: string;
    params: Record<string, string>;
    body: string;
    lineStart: number;
    lineEnd: number;
}
export interface IRSection {
    level: number;
    heading: string;
    slug: string;
    content: string;
    blocks: IRBlock[];
    lineStart: number;
}
export interface IRDocument {
    frontmatter: IRFrontmatter;
    frontmatterWarnings: string[];
    sections: IRSection[];
    blocks: IRBlock[];
    rawBody: string;
}
/**
 * Parse a .report.md IR source into a structured document.
 */
export declare function parseDocument(source: string): IRDocument;
/**
 * Parse all :::tag ... ::: blocks from the body.
 */
export declare function parseBlocks(body: string, lineOffset?: number): IRBlock[];
/**
 * Parse sections split by ## headings.
 */
export declare function parseSections(body: string, blocks: IRBlock[], lineOffset?: number): IRSection[];
export { parseFrontmatter, type IRFrontmatter, type FrontmatterParseResult };
