import type { IRFrontmatter } from '../parser/frontmatter.js';
export interface ShellOptions {
    title: string;
    theme: string;
    lang: string;
    css: string;
    needsEcharts: boolean;
    needsHighlightjs: boolean;
    toc: boolean;
    animations: boolean;
    irHash: string;
    reportSummaryJson: string;
    bodyContent: string;
    tocItems: Array<{
        slug: string;
        text: string;
        level: number;
    }>;
    author: string;
    date: string;
    abstract: string;
    version: string;
    frontmatter?: IRFrontmatter;
}
export declare function buildHtmlShell(opts: ShellOptions): string;
