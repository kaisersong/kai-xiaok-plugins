import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleValidateIR } from '../src/tools/validate-ir.js';
import { handleRenderReport } from '../src/tools/render-report.js';

const header = '---\ntitle: Fixture report\ntheme: corporate-blue\ndate: 2026-10-31\nlang: en\nreport_class: narrative\nanimations: false\n---\n\n## Architecture\n';
const graph = 'graph TD\nA[Fixture A] --> B[Fixture B]';

describe('unsupported raw Mermaid', () => {
  it.each(['```mermaid', '~~~~MeRmAiD', '  ``` mermaid', '\t~~~mermaid'])('rejects %s with an original 1-based line and safe guidance', open => {
    const result = handleValidateIR({ ir_content: header + open + '\n' + graph + '\n```\n' });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({
      tag: 'mermaid', status: 'unsupported_syntax',
      message: expect.stringMatching(/line 11.*:::diagram/i),
    })]));
    expect(JSON.stringify(result.errors)).not.toContain('Fixture A');
  });

  it('handles CRLF and rejects unclosed Mermaid', () => {
    expect(handleValidateIR({ ir_content: (header + '```mermaid\n' + graph).replaceAll('\n', '\r\n') }).valid).toBe(false);
  });

  it('invalid backtick info cannot hide a raw graph or overwrite accepted HTML', () => {
    const ir = header + '```text `\n```mermaid\n' + graph + '\n```';
    expect(handleValidateIR({ ir_content: ir }).valid).toBe(false);
    const directory = mkdtempSync(join(tmpdir(), 'report-pseudo-fence-'));
    try {
      const output = join(directory, 'report.html');
      expect(handleRenderReport({ ir_content: ir, output_path: output }).success).toBe(false);
      expect(existsSync(output)).toBe(false);
      writeFileSync(output, 'accepted artifact');
      expect(handleRenderReport({ ir_content: ir, output_path: output }).success).toBe(false);
      expect(readFileSync(output, 'utf8')).toBe('accepted artifact');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it.each([false, 'scrollytelling'])('does not create or overwrite output before render mode %s', mode => {
    const directory = mkdtempSync(join(tmpdir(), 'report-mermaid-'));
    try {
      const output = join(directory, 'report.html');
      const ir = header.replace('animations: false', `animations: ${mode}`) + '```mermaid\n' + graph + '\n```';
      const first = handleRenderReport({ ir_content: ir, output_path: output });
      expect(first.success).toBe(false);
      expect(first.validation.l0_passed).toBe(false);
      expect(existsSync(output)).toBe(false);
      writeFileSync(output, 'existing accepted artifact');
      const second = handleRenderReport({ ir_content: ir, output_path: output });
      expect(second.success).toBe(false);
      expect(readFileSync(output, 'utf8')).toBe('existing accepted artifact');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('preserves supported native diagrams and literal native code examples', () => {
    for (const body of [
      ':::diagram type=flowchart\nA -> B\n:::',
      ':::code lang=markdown\n```mermaid\n' + graph + '\n```\n:::',
      '````markdown\n```mermaid\n' + graph + '\n```\n````',
      '```mermaid-example\n' + graph + '\n```',
    ]) {
      const result = handleValidateIR({ ir_content: header + body });
      expect(result.errors.filter(e => e.tag === 'mermaid')).toEqual([]);
    }
  });

  it.each([
    ':::code\nliteral\n:::\n```mermaid\n' + graph,
    ':::callout\n:::code\n```mermaid\n' + graph + '\n```\n:::',
    ':::CODE\n```mermaid\n' + graph + '\n```\n:::',
    ' ```text\n~~~~\n```\n~~~mermaid\n' + graph,
    '````text\n```\n````\n```mermaid\n' + graph,
  ])('does not let pseudo code blocks or fence endings hide a later graph', body => {
    expect(handleValidateIR({ ir_content: header + body }).errors.some(e => e.tag === 'mermaid')).toBe(true);
  });
});
