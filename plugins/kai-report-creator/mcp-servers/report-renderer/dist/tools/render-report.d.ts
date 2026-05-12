export interface RenderReportInput {
    ir_content: string;
    output_path?: string;
    theme_override?: string;
    bundle?: boolean;
}
export declare function handleRenderReport(input: RenderReportInput): {
    success: boolean;
    output_path: string;
    validation: {
        l0_passed: boolean;
        l1_passed: boolean;
        l2_passed: boolean;
    };
    warnings: string[];
    stats: {
        sections: number;
        components: number;
        css_bytes: number;
        html_bytes: number;
    };
};
