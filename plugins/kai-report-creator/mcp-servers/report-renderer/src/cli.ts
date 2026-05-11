#!/usr/bin/env node
/**
 * CLI entry point for the report-renderer.
 * Usage:
 *   node dist/cli.js render <ir-file> [--output <path>] [--theme <name>]
 *   node dist/cli.js validate <ir-file>
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { renderReport } from './renderer/html-builder.js';

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  console.log(`Usage:
  node dist/cli.js render <ir-file> [--output <path>] [--theme <name>]
  node dist/cli.js validate <ir-file>`);
  process.exit(0);
}

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const irFile = args[1];
if (!irFile) {
  console.error('Error: missing IR file path');
  process.exit(1);
}

const irPath = resolve(irFile);
let irContent: string;
try {
  irContent = readFileSync(irPath, 'utf-8');
} catch (e) {
  console.error(`Error: cannot read file: ${irPath}`);
  process.exit(1);
}

if (command === 'validate') {
  // Just parse and check for obvious issues
  const hasTripleFences = /^---\n[\s\S]+?\n---/m.test(irContent);
  const hasBlocks = /^:::\w+/m.test(irContent);
  const closedBlocks = (irContent.match(/^:::\w+/gm) ?? []).length ===
    (irContent.match(/^:::$/gm) ?? []).length;

  if (!hasTripleFences) {
    console.error('❌ Missing frontmatter (---...---)');
    process.exit(1);
  }
  if (!hasBlocks) {
    console.error('❌ No ::: component blocks found');
    process.exit(1);
  }
  if (!closedBlocks) {
    console.error('❌ Unclosed ::: blocks detected');
    process.exit(1);
  }
  console.log('✅ IR validation passed');
  process.exit(0);
}

if (command === 'render') {
  const outputFlag = getFlag('output');
  const themeOverride = getFlag('theme');

  const defaultOutput = resolve(dirname(irPath), basename(irPath, '.report.md') + '.html');
  const outputPath = outputFlag ? resolve(outputFlag) : defaultOutput;

  const result = renderReport({
    irContent,
    outputPath,
    themeOverride,
  });

  if (result.success) {
    console.log(JSON.stringify({
      success: true,
      output_path: result.outputPath,
      stats: result.stats,
      validation: result.validation,
    }, null, 2));
  } else {
    console.error(JSON.stringify({
      success: false,
      warnings: result.warnings,
      validation: result.validation,
    }, null, 2));
    process.exit(1);
  }
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
