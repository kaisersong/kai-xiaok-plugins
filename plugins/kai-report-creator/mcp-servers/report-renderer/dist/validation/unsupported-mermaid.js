import { parseFrontmatter } from '../parser/frontmatter.js';
import { parseBlocks } from '../parser/ir-parser.js';
/** Reject diagrams the renderer would otherwise silently collapse into prose. */
export function findUnsupportedMermaid(source) {
    const { bodyStart } = parseFrontmatter(source);
    const lines = source.split('\n');
    const codeBlocks = parseBlocks(lines.slice(bodyStart).join('\n'), bodyStart)
        .filter(block => block.tag === 'code');
    const issues = [];
    let literalFence = null;
    for (let index = bodyStart; index < lines.length; index++) {
        const line = lines[index].trim();
        if (literalFence) {
            const close = line.match(/^(`{3,}|~{3,})\s*$/);
            if (close && close[1][0] === literalFence.char && close[1].length >= literalFence.length) {
                literalFence = null;
            }
            continue;
        }
        // Respect exactly the parser's native code ranges, not pseudo directives
        // inside callouts or differently-cased directives it does not recognize.
        if (codeBlocks.some(block => index >= block.lineStart && index <= block.lineEnd))
            continue;
        const open = line.match(/^(`{3,}|~{3,})\s*(.*)$/);
        if (!open)
            continue;
        // Backtick info strings cannot themselves contain backticks. An invalid
        // pseudo fence must not hide a later real Mermaid block as a literal.
        if (open[1][0] === '`' && open[2].includes('`'))
            continue;
        if (/^mermaid(?:\s|$)/i.test(open[2])) {
            issues.push({
                line: index + 1,
                message: `Unsupported raw Mermaid fence at line ${index + 1}; convert to a supported :::diagram component. Do not handwrite HTML.`,
            });
        }
        literalFence = { char: open[1][0], length: open[1].length };
    }
    return issues;
}
//# sourceMappingURL=unsupported-mermaid.js.map