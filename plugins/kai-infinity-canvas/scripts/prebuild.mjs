#!/usr/bin/env node
/**
 * Pre-build script for release.
 * Verifies dist/ is fresh and tests pass.
 *
 * Usage: node scripts/prebuild.mjs
 */

import { execSync } from 'node:child_process'
import { accessSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pluginRoot = resolve(__dirname, '..')
const distIndex = join(pluginRoot, 'dist', 'index.html')

console.log('── kai-infinity-canvas prebuild ──')

// Step 1: Clean install
console.log('1. Installing dependencies...')
execSync('npm ci', { cwd: pluginRoot, stdio: 'inherit' })

// Step 2: Build
console.log('2. Building frontend...')
execSync('npm run build', { cwd: pluginRoot, stdio: 'inherit' })

// Step 3: Verify dist
console.log('3. Verifying dist...')
try {
  accessSync(distIndex)
  const stats = statSync(distIndex)
  console.log(`   ✓ dist/index.html exists (${stats.size} bytes)`)
} catch {
  console.error('   ✗ dist/index.html not found after build!')
  process.exit(1)
}

// Step 4: Run tests
console.log('4. Running tests...')
try {
  execSync('node tests/mcp.test.mjs', { cwd: pluginRoot, stdio: 'inherit' })
  console.log('   ✓ All tests passed')
} catch {
  console.error('   ✗ Tests failed!')
  process.exit(1)
}

console.log('\n✅ Prebuild complete. dist/ is ready for release.')
