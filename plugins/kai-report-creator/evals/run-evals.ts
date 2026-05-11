/**
 * Eval runner for kai-report-creator plugin.
 * Renders all eval cases and scores them against the rubric.
 *
 * Usage: node --import tsx evals/run-evals.ts
 * Or after compile: node dist/evals/run-evals.js
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from '../mcp-servers/report-renderer/src/renderer/html-builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const casesDir = join(__dirname, 'cases');
const rubric = JSON.parse(readFileSync(join(__dirname, 'rubric.json'), 'utf-8'));

interface EvalResult {
  caseName: string;
  scores: Record<string, number>;
  totalScore: number;
  passed: boolean;
  renderTimeMs: number;
  outputSizeKb: number;
  errors: string[];
}

function runEval(irPath: string): EvalResult {
  const caseName = irPath.replace('.report.md', '');
  const irContent = readFileSync(join(casesDir, irPath), 'utf-8');
  const errors: string[] = [];
  const scores: Record<string, number> = {};

  const startTime = performance.now();
  const result = renderReport({
    irContent,
    outputPath: join('/tmp', `eval-${caseName}.html`),
  });
  const renderTimeMs = Math.round(performance.now() - startTime);

  // Score L0
  scores['l0_validation'] = result.validation.l0 ? rubric.scoring.l0_validation.weight : 0;
  if (!result.validation.l0) errors.push('L0 failed: ::: leakage or missing ir-hash');

  // Score L1
  scores['l1_shell'] = result.validation.l1 ? rubric.scoring.l1_shell.weight : 0;
  if (!result.validation.l1) errors.push('L1 failed: shell structure incomplete');

  // Score L2
  scores['l2_ids'] = result.validation.l2 ? rubric.scoring.l2_ids.weight : 0;
  if (!result.validation.l2) errors.push('L2 failed: missing required IDs');

  // Score component accuracy (check no "unknown component" or empty comments)
  const unknownCount = (result.html.match(/<!-- unknown component/g) ?? []).length;
  const emptyCount = (result.html.match(/<!-- empty/g) ?? []).length;
  const componentScore = Math.max(0, rubric.scoring.component_accuracy.weight - unknownCount * 5 - emptyCount * 2);
  scores['component_accuracy'] = componentScore;

  // Score theme integrity
  const hasCSS = result.stats.cssBytes > 1000;
  scores['theme_integrity'] = hasCSS ? rubric.scoring.theme_integrity.weight : 0;

  // Score performance
  scores['performance'] = renderTimeMs < 500 ? rubric.scoring.performance.weight : Math.max(0, rubric.scoring.performance.weight - Math.floor(renderTimeMs / 200));

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  return {
    caseName,
    scores,
    totalScore,
    passed: totalScore >= rubric.pass_threshold,
    renderTimeMs,
    outputSizeKb: Math.round(result.stats.htmlBytes / 1024 * 10) / 10,
    errors,
  };
}

// Run all cases
const cases = readdirSync(casesDir).filter(f => f.endsWith('.report.md'));
console.log(`\n📊 kai-report-creator Eval Runner\n${'='.repeat(50)}`);
console.log(`Cases: ${cases.length} | Pass threshold: ${rubric.pass_threshold}/100\n`);

const results: EvalResult[] = [];
for (const c of cases) {
  const result = runEval(c);
  results.push(result);

  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | ${result.caseName}`);
  console.log(`  Score: ${result.totalScore}/100 | Time: ${result.renderTimeMs}ms | Size: ${result.outputSizeKb}KB`);
  if (result.errors.length > 0) {
    result.errors.forEach(e => console.log(`  ⚠️  ${e}`));
  }
  console.log();
}

// Summary
const passCount = results.filter(r => r.passed).length;
const avgScore = Math.round(results.reduce((s, r) => s + r.totalScore, 0) / results.length);
const avgTime = Math.round(results.reduce((s, r) => s + r.renderTimeMs, 0) / results.length);

console.log('='.repeat(50));
console.log(`Summary: ${passCount}/${results.length} passed | Avg score: ${avgScore}/100 | Avg time: ${avgTime}ms`);
console.log();

// Exit code
process.exit(passCount === results.length ? 0 : 1);
