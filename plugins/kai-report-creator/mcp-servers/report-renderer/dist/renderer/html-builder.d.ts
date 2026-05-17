export interface RenderResult {
    success: boolean;
    outputPath: string;
    html: string;
    validation: {
        l0: boolean;
        l1: boolean;
        l2: boolean;
        l3: boolean;
    };
    warnings: string[];
    stats: {
        sections: number;
        components: number;
        cssBytes: number;
        htmlBytes: number;
    };
}
export interface RenderInput {
    irContent: string;
    outputPath?: string;
    themeOverride?: string;
    bundle?: boolean;
}
export declare function renderReport(input: RenderInput): RenderResult;
