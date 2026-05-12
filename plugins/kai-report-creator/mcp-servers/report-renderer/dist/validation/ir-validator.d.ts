import type { IRBlock } from '../parser/ir-parser.js';
export type ValidationStatus = 'valid' | 'invalid_syntax' | 'invalid_semantics' | 'contract_conflict';
export interface BlockValidationResult {
    status: ValidationStatus;
    message?: string;
    autoDowngradeTarget?: string;
}
export interface DocumentValidationResult {
    valid: boolean;
    errors: Array<{
        blockIndex: number;
        tag: string;
        status: ValidationStatus;
        message: string;
        autoDowngradeTarget?: string;
    }>;
    blockCount: number;
    componentSummary: Record<string, number>;
}
/**
 * Validate all blocks in a document.
 */
export declare function validateBlocks(blocks: IRBlock[], reportClass: string): DocumentValidationResult;
/**
 * Dispatch validation to the appropriate handler.
 */
export declare function validateBlock(block: IRBlock, reportClass: string): BlockValidationResult;
