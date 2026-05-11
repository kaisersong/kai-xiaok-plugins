import { renderReport } from '../renderer/html-builder.js';

export interface RenderReportInput {
  ir_content: string;
  output_path?: string;
  theme_override?: string;
  bundle?: boolean;
}

export function handleRenderReport(input: RenderReportInput) {
  const result = renderReport({
    irContent: input.ir_content,
    outputPath: input.output_path,
    themeOverride: input.theme_override,
    bundle: input.bundle,
  });

  return {
    success: result.success,
    output_path: result.outputPath,
    validation: {
      l0_passed: result.validation.l0,
      l1_passed: result.validation.l1,
      l2_passed: result.validation.l2,
    },
    warnings: result.warnings,
    stats: {
      sections: result.stats.sections,
      components: result.stats.components,
      css_bytes: result.stats.cssBytes,
      html_bytes: result.stats.htmlBytes,
    },
  };
}
