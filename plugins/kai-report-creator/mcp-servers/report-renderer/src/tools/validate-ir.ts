import { parseDocument } from '../parser/ir-parser.js';
import { validateBlocks, type DocumentValidationResult } from '../validation/ir-validator.js';
import { checkContentQuality, type QualityHint } from '../validation/quality-checks.js';

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

export function handleValidateIR(input: ValidateIRInput): ValidateIROutput {
  const { ir_content } = input;

  if (!ir_content || !ir_content.trim()) {
    return {
      valid: false,
      errors: [{ block_index: -1, tag: '', status: 'invalid_syntax', message: 'Empty IR content' }],
      quality_hints: [],
      frontmatter_warnings: [],
      block_count: 0,
      component_summary: {},
    };
  }

  const doc = parseDocument(ir_content);
  const validation = validateBlocks(doc.blocks, doc.frontmatter.report_class);
  const qualityHints = checkContentQuality(doc);

  return {
    valid: validation.valid && doc.frontmatterWarnings.length === 0,
    errors: validation.errors.map(e => ({
      block_index: e.blockIndex,
      tag: e.tag,
      status: e.status,
      message: e.message,
      auto_downgrade_target: e.autoDowngradeTarget,
    })),
    quality_hints: qualityHints,
    frontmatter_warnings: doc.frontmatterWarnings,
    block_count: validation.blockCount,
    component_summary: validation.componentSummary,
  };
}
