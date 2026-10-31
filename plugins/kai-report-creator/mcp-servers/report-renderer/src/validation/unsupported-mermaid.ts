import { parseFrontmatter } from '../parser/frontmatter.js';
import { parseBlocks } from '../parser/ir-parser.js';

export interface UnsupportedMermaid {
  line: number;
  message: string;
}

/** Reject diagrams the renderer would otherwise silently collapse into prose. */
export function findUnsupportedMermaid(source: string): UnsupportedMermaid[] {
  const { bodyStart } = parseFrontmatter(source);
  const lines = source.split('\n');
  const codeBlocks = parseBlocks(lines.slice(bodyStart).join('\n'), bodyStart)
    .filter(block => block.tag === 'code');
  const issues: UnsupportedMermaid[] = [];
  let literalFence: { char: string; length: number } | null = null;

  for (let index = bodyStart; index < lines.length; index++) {
    const line = lines[index]!.trim();
    if (literalFence) {
      const close = line.match(/^(`{3,}|~{3,})\s*$/);
      if (close && close[1]![0] === literalFence.char && close[1]!.length >= literalFence.length) {
        literalFence = null;
      }
      continue;
    }
    // Respect exactly the parser's native code ranges, not pseudo directives
    // inside callouts or differently-cased directives it does not recognize.
    if (codeBlocks.some(block => index >= block.lineStart && index <= block.lineEnd)) continue;
    const open = line.match(/^(`{3,}|~{3,})\s*(.*)$/);
    if (!open) continue;
    if (/^mermaid(?:\s|$)/i.test(open[2]!)) {
      issues.push({
        line: index + 1,
        message: `Unsupported raw Mermaid fence at line ${index + 1}; convert to a supported :::diagram component. Do not handwrite HTML.`,
      });
    }
    literalFence = { char: open[1]![0]!, length: open[1]!.length };
  }
  return issues;
}
