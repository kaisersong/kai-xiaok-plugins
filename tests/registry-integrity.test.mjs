import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_STEP_KINDS,
  computeGitTreeSha256,
  gitCapture,
  isCommitOnOrigin,
  readPluginTreeEntries,
  generateRegistryV2,
} from '../scripts/update-registry-v2.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const registryV2Path = join(repoRoot, 'registry-v2.json');

function readRegistryV2() {
  assert.ok(existsSync(registryV2Path), 'registry-v2.json must exist');
  return JSON.parse(readFileSync(registryV2Path, 'utf8'));
}

test('the digest format matches the xiaok-cli golden vector', () => {
  const sha256 = (value) => createHash('sha256').update(value).digest('hex');
  const entries = [
    { mode: '100644', path: 'plugin.json', contentSha256: sha256(Buffer.from('x')) },
    { mode: '100755', path: 'bin/run.sh', contentSha256: sha256(Buffer.from('#!/bin/sh\n')) },
  ];

  assert.equal(
    computeGitTreeSha256(entries),
    'a2d0de20feda198a01ebb43d86f5ec8c2545234c2f26b64bfe9c830b4c50ed5f',
  );
});

test('registry-v2.json is a well formed v2 document', () => {
  const registry = readRegistryV2();

  assert.equal(registry.version, 2);
  assert.ok(Array.isArray(registry.plugins) && registry.plugins.length > 0);

  const names = new Set();
  for (const plugin of registry.plugins) {
    assert.match(plugin.name, /^[a-z0-9][a-z0-9-]{0,63}$/);
    assert.equal(names.has(plugin.name), false, `duplicate plugin ${plugin.name}`);
    names.add(plugin.name);
    assert.equal(plugin.repo, 'kaisersong/kai-xiaok-plugins');
    assert.match(plugin.path, /^plugins\/[a-z0-9][a-z0-9-]*$/);
    assert.match(plugin.version, /^\d+\.\d+\.\d+/);
    assert.match(plugin.source.commit, /^[0-9a-f]{40}$/);
    assert.match(plugin.source.treeSha256, /^[0-9a-f]{64}$/);
    assert.ok(Array.isArray(plugin.install.steps));
    assert.equal(
      JSON.stringify(plugin).includes('&&'),
      false,
      `plugin ${plugin.name} must not carry shell install strings`,
    );
  }
});

test('every entry digest matches the plugin file manifest at its pinned commit', () => {
  for (const plugin of readRegistryV2().plugins) {
    const entries = readPluginTreeEntries(repoRoot, plugin.source.commit, plugin.path);
    assert.ok(entries.length > 0, `${plugin.name} has no files at ${plugin.source.commit}`);
    assert.equal(
      computeGitTreeSha256(entries),
      plugin.source.treeSha256,
      `${plugin.name} digest does not match its pinned commit content`,
    );
  }
});

test('every entry version matches plugin.json at its pinned commit', () => {
  for (const plugin of readRegistryV2().plugins) {
    const manifest = JSON.parse(
      gitCapture(repoRoot, ['show', `${plugin.source.commit}:${plugin.path}/plugin.json`]),
    );
    assert.equal(manifest.name, plugin.name);
    assert.equal(manifest.version, plugin.version);
  }
});

test('pinned commits are reachable from origin', () => {
  for (const plugin of readRegistryV2().plugins) {
    assert.equal(
      isCommitOnOrigin(repoRoot, plugin.source.commit),
      true,
      `${plugin.name} pins commit ${plugin.source.commit} which is not reachable from origin`,
    );
  }
});

test('install steps are typed, in-tree and never auto-install unhashed requirements', () => {
  for (const plugin of readRegistryV2().plugins) {
    const entries = readPluginTreeEntries(repoRoot, plugin.source.commit, plugin.path);
    const paths = new Set(entries.map((entry) => entry.path));
    const manifest = JSON.parse(
      gitCapture(repoRoot, ['show', `${plugin.source.commit}:${plugin.path}/plugin.json`]),
    );
    const serverNames = new Set((manifest.mcpServers ?? []).map((server) => server.name));

    for (const step of plugin.install.steps) {
      assert.ok(ALLOWED_STEP_KINDS.includes(step.kind), `${plugin.name} has step kind ${step.kind}`);
      assert.equal(step.cwd.includes('..'), false);

      if (step.kind === 'npm_ci' || step.kind === 'npm_run') {
        const prefix = step.cwd === '.' ? '' : `${step.cwd}/`;
        assert.ok(paths.has(`${prefix}package.json`), `${plugin.name} step cwd lacks package.json`);
        assert.ok(paths.has(`${prefix}package-lock.json`), `${plugin.name} npm step lacks package-lock.json`);
      }
      if (step.kind === 'npm_run') {
        assert.match(step.script, /^[A-Za-z0-9][A-Za-z0-9:_.-]*$/);
      }
      if (step.kind === 'python_requirements') {
        const prefix = step.cwd === '.' ? '' : `${step.cwd}/`;
        const file = `${prefix}${step.file}`;
        assert.ok(paths.has(file), `${plugin.name} requirements file ${file} is missing`);
        const body = gitCapture(repoRoot, ['show', `${plugin.source.commit}:${plugin.path}/${file}`]);
        for (const line of body.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          assert.ok(
            trimmed.includes('--hash=sha256:'),
            `${plugin.name} auto-installs unhashed requirement "${trimmed}"; declare it external instead`,
          );
        }
      }
      if (step.kind === 'external') {
        assert.ok(Array.isArray(step.serverNames) && step.serverNames.length > 0);
        for (const name of step.serverNames) {
          assert.ok(serverNames.has(name), `${plugin.name} external step names unknown server ${name}`);
        }
      }
    }
  }
});

test('regenerating the registry from the pinned commits is a no-op', () => {
  const current = readRegistryV2();
  const regenerated = generateRegistryV2({
    repoRoot,
    commit: current.plugins[0].source.commit,
    allowDirtyWorktree: true,
  });

  assert.equal(
    JSON.stringify(regenerated, null, 2),
    JSON.stringify(current, null, 2),
    'registry-v2.json is stale; re-run scripts/update-registry-v2.mjs',
  );
});

test('the legacy v1 registry stays untouched for older CLIs', () => {
  const legacy = JSON.parse(readFileSync(join(repoRoot, 'registry.json'), 'utf8'));

  assert.equal(legacy.version, 1);
  assert.ok(legacy.plugins.every((plugin) => typeof plugin.dependencies?.install === 'string'));
});
