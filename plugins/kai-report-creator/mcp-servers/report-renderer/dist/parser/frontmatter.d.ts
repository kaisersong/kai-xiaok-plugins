export interface IRFrontmatter {
    title: string;
    theme: string;
    date: string;
    lang: 'zh' | 'en';
    report_class: 'narrative' | 'mixed' | 'data';
    archetype?: 'brief' | 'research' | 'comparison' | 'update';
    audience?: string;
    decision_goal?: string;
    must_include?: string[];
    must_avoid?: string[];
    charts?: 'cdn' | 'bundle';
    toc?: boolean;
    animations?: boolean;
    abstract?: string;
    author?: string;
    poster_title?: string;
    poster_subtitle?: string;
    poster_note?: string;
    template?: string;
    theme_overrides?: Record<string, string>;
    custom_blocks?: Record<string, string>;
}
export interface FrontmatterParseResult {
    frontmatter: IRFrontmatter;
    warnings: string[];
    bodyStart: number;
}
export declare function parseFrontmatter(source: string): FrontmatterParseResult;
