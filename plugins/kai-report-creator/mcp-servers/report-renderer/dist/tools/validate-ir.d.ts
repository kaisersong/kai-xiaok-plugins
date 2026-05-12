import { type QualityHint } from '../validation/quality-checks.js';
export interface ValidateIRInput {
    ir_content: string;
}
export interface ValidateIROutput {
    valid: boolean;
    errors: Array<{
        block_index: number;
        tag: string;
        status: string;
        message: string;
        auto_downgrade_target?: string;
    }>;
    quality_hints: QualityHint[];
    frontmatter_warnings: string[];
    block_count: number;
    component_summary: Record<string, number>;
}
export declare function handleValidateIR(input: ValidateIRInput): ValidateIROutput;
