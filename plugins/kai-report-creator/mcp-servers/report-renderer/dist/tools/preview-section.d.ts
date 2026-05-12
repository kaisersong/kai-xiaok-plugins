export interface PreviewSectionInput {
    section_ir: string;
    theme?: string;
    lang?: string;
}
export interface PreviewSectionResult {
    html_fragment: string;
    validation_errors: string[];
}
export declare function handlePreviewSection(input: PreviewSectionInput): PreviewSectionResult;
