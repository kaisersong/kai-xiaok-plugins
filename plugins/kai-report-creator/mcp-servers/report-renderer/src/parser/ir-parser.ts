import { parseFrontmatter, type IRFrontmatter, type FrontmatterParseResult } from './frontmatter.js';

export interface IRBlock {
  tag: string;
  params: Record<string, string>;
  body: string;
  lineStart: number;
  lineEnd: number;
}

export interface IRSection {
  level: number;
  heading: string;
  slug: string;
  content: string;
  blocks: IRBlock[];
  lineStart: number;
}

export interface IRDocument {
  frontmatter: IRFrontmatter;
  frontmatterWarnings: string[];
  sections: IRSection[];
  blocks: IRBlock[];
  rawBody: string;
}

const STRUCTURAL_DIRECTIVES = new Set(['cover', 'toc', 'section']);

/**
 * Parse a .report.md IR source into a structured document.
 */
export function parseDocument(source: string): IRDocument {
  const { frontmatter, warnings, bodyStart } = parseFrontmatter(source);
  const lines = source.split('\n');
  const rawBody = lines.slice(bodyStart).join('\n');

  const blocks = parseBlocks(rawBody, bodyStart);
  const sections = parseSections(rawBody, blocks, bodyStart);

  return {
    frontmatter,
    frontmatterWarnings: warnings,
    sections,
    blocks,
    rawBody,
  };
}

/**
 * Parse all :::tag ... ::: blocks from the body.
 */
export function parseBlocks(body: string, lineOffset = 0): IRBlock[] {
  const lines = body.split('\n');
  const blocks: IRBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const openMatch = line.match(/^:::\s*(\w+)\s*(.*)?$/);

    if (openMatch) {
      const tag = openMatch[1]!;
      const paramStr = openMatch[2] ?? '';
      if (STRUCTURAL_DIRECTIVES.has(tag)) {
        i++;
        continue;
      }
      const params = parseParams(paramStr);
      const lineStart = i + lineOffset;
      const bodyLines: string[] = [];

      i++;
      // Find closing :::
      while (i < lines.length) {
        if (lines[i]!.trim() === ':::') {
          break;
        }
        bodyLines.push(lines[i]!);
        i++;
      }

      blocks.push({
        tag,
        params,
        body: bodyLines.join('\n'),
        lineStart,
        lineEnd: i + lineOffset,
      });
    }
    i++;
  }

  return blocks;
}

/**
 * Parse sections split by ## headings.
 */
export function parseSections(body: string, blocks: IRBlock[], lineOffset = 0): IRSection[] {
  const lines = body.split('\n');
  const sections: IRSection[] = [];
  let currentSection: IRSection | null = null;
  const contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);

    if (headingMatch) {
      // Flush previous section
      if (currentSection) {
        currentSection.content = contentLines.join('\n');
        currentSection.blocks = blocks.filter(
          b => b.lineStart >= currentSection!.lineStart && b.lineEnd <= i + lineOffset
        );
        sections.push(currentSection);
        contentLines.length = 0;
      }

      const level = headingMatch[1]!.length;
      const heading = headingMatch[2]!.trim();
      currentSection = {
        level,
        heading,
        slug: slugify(heading),
        content: '',
        blocks: [],
        lineStart: i + lineOffset,
      };
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  // Flush last section
  if (currentSection) {
    currentSection.content = contentLines.join('\n');
    currentSection.blocks = blocks.filter(
      b => b.lineStart >= currentSection!.lineStart
    );
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Parse inline params from a ::: opening line.
 * e.g., "type=bar title='Monthly Revenue'" → { type: 'bar', title: 'Monthly Revenue' }
 */
function parseParams(paramStr: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!paramStr.trim()) return params;

  // Match key=value or key='value with spaces' or key="value"
  const regex = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(paramStr)) !== null) {
    const key = match[1]!;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    params[key] = value;
  }

  return params;
}

/**
 * Generate a URL-friendly slug from a heading.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export { parseFrontmatter, type IRFrontmatter, type FrontmatterParseResult };
