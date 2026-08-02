#!/usr/bin/env node
/**
 * Generates registry-v2.json from committed Git objects.
 *
 * The digest never comes from the working tree: every blob is read out of the
 * object store at a pinned commit, so a dirty checkout cannot leak unpublished
 * bytes into a published entry. registry.json (v1) is left untouched so older
 * CLIs keep working.
 *
 * Usage:
 *   node scripts/update-registry-v2.mjs [--commit <sha>] [--check] [--allow-dirty-worktree]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWED_STEP_KINDS = ['npm_ci', 'npm_run', 'python_requirements', 'external'];

const GIT_MODE_REGULAR = '100644';
const GIT_MODE_EXECUTABLE = '100755';
const GIT_MODE_SYMLINK = '120000';
const SUPPORTED_MODES = new Set([GIT_MODE_REGULAR, GIT_MODE_EXECUTABLE, GIT_MODE_SYMLINK]);

/**
 * Typed replacements for the v1 `dependencies.install` shell strings.
 * Anything that cannot be executed safely and reproducibly is `external`:
 * unhashed pip requirements and the macOS-only CUA driver installer.
 */
const PLUGIN_SPECS = [
  {
    name: 'cua-computer-use',
    path: 'plugins/cua-computer-use',
    steps: [
      {
        kind: 'external',
        serverNames: ['cua-driver'],
        reason: 'CUA Driver is installed through Xiaok Settings on macOS',
      },
    ],
  },
  {
    name: 'kai-infinity-canvas',
    path: 'plugins/kai-infinity-canvas',
    steps: [
      { kind: 'npm_ci', cwd: '.' },
      { kind: 'npm_run', cwd: '.', script: 'build' },
    ],
  },
  {
    name: 'kai-meeting-assistant',
    path: 'plugins/kai-meeting-assistant',
    steps: [
      {
        kind: 'external',
        serverNames: ['meeting-transcriber'],
        reason: 'requirements.txt has no hash pins; install Whisper dependencies manually',
      },
    ],
  },
  {
    name: 'kai-report-creator',
    path: 'plugins/kai-report-creator',
    steps: [
      { kind: 'npm_ci', cwd: 'mcp-servers/report-renderer' },
      { kind: 'npm_run', cwd: 'mcp-servers/report-renderer', script: 'build' },
    ],
  },
  {
    name: 'kai-slide-creator',
    path: 'plugins/kai-slide-creator',
    steps: [
      {
        kind: 'external',
        serverNames: ['slide-renderer'],
        reason: 'requirements.txt has no hash pins; install the Python runtime manually',
      },
    ],
  },
];

export function gitCapture(repoRoot, args, encoding = 'utf8') {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding,
    maxBuffer: 256 * 1024 * 1024,
  });
}

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function computeGitTreeSha256(entries) {
  const seen = new Set();
  const sorted = [...entries].sort((a, b) =>
    Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8')),
  );
  const records = [];

  for (const entry of sorted) {
    if (!SUPPORTED_MODES.has(entry.mode)) {
      throw new Error(`Unsupported git mode ${entry.mode} for ${entry.path}`);
    }
    if (!/^[0-9a-f]{64}$/.test(entry.contentSha256)) {
      throw new Error(`Invalid content SHA-256 for ${entry.path}`);
    }
    if (seen.has(entry.path)) {
      throw new Error(`Duplicate path ${entry.path}`);
    }
    seen.add(entry.path);
    records.push(Buffer.from(`${entry.mode} ${entry.contentSha256}\t${entry.path}\0`, 'utf8'));
  }

  return sha256Hex(Buffer.concat(records));
}

function hashBlob(repoRoot, oid) {
  const result = spawnSync('git', ['cat-file', 'blob', oid], {
    cwd: repoRoot,
    maxBuffer: 512 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git cat-file blob ${oid} failed: ${String(result.stderr)}`);
  }
  return sha256Hex(result.stdout);
}

export function readPluginTreeEntries(repoRoot, commit, pluginPath) {
  const stdout = gitCapture(repoRoot, ['ls-tree', '-r', '-z', '--full-tree', commit, '--', pluginPath]);
  const prefix = `${pluginPath}/`;
  const entries = [];
  const relativePaths = [];

  for (const record of stdout.split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    const meta = record.slice(0, tab).split(' ');
    const repoPath = record.slice(tab + 1);
    const [mode, type, oid] = meta;

    if (mode === '160000' || type === 'commit') {
      throw new Error(`Plugin ${pluginPath} contains a gitlink at ${repoPath}`);
    }
    if (!SUPPORTED_MODES.has(mode)) {
      throw new Error(`Plugin ${pluginPath} contains unsupported mode ${mode} at ${repoPath}`);
    }
    if (!repoPath.startsWith(prefix)) {
      throw new Error(`Unexpected path ${repoPath} outside ${pluginPath}`);
    }

    const relative = repoPath.slice(prefix.length);
    if (relative !== relative.normalize('NFC')) {
      throw new Error(`Plugin ${pluginPath} has a non-NFC path ${relative}`);
    }
    if (relative.split('/').includes('..') || relative.startsWith('-')) {
      throw new Error(`Plugin ${pluginPath} has an unsafe path ${relative}`);
    }

    relativePaths.push(relative);
    entries.push({ mode, path: relative, contentSha256: hashBlob(repoRoot, oid) });
  }

  const lowered = new Map();
  for (const path of relativePaths) {
    const key = path.normalize('NFC').toLowerCase();
    if (lowered.has(key)) {
      throw new Error(`Plugin ${pluginPath} has conflicting paths ${lowered.get(key)} and ${path}`);
    }
    lowered.set(key, path);
  }

  return entries;
}

export function isCommitOnOrigin(repoRoot, commit) {
  const refs = gitCapture(repoRoot, [
    'for-each-ref',
    '--format=%(objectname)',
    'refs/remotes/origin',
  ])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const ref of refs) {
    const result = spawnSync('git', ['merge-base', '--is-ancestor', commit, ref], { cwd: repoRoot });
    if (result.status === 0) return true;
  }
  return false;
}

function readManifest(repoRoot, commit, pluginPath) {
  return JSON.parse(gitCapture(repoRoot, ['show', `${commit}:${pluginPath}/plugin.json`]));
}

function validateSteps(steps, entries, manifest, spec) {
  const paths = new Set(entries.map((entry) => entry.path));
  const serverNames = new Set((manifest.mcpServers ?? []).map((server) => server.name));

  for (const step of steps) {
    if (!ALLOWED_STEP_KINDS.includes(step.kind)) {
      throw new Error(`${spec.name} declares unsupported step kind ${step.kind}`);
    }
    const cwd = step.cwd ?? '.';
    const prefix = cwd === '.' ? '' : `${cwd}/`;

    if (step.kind === 'npm_ci' || step.kind === 'npm_run') {
      for (const required of ['package.json', 'package-lock.json']) {
        if (!paths.has(`${prefix}${required}`)) {
          throw new Error(`${spec.name} step "${step.kind}" needs ${prefix}${required} at the pinned commit`);
        }
      }
    }
    if (step.kind === 'python_requirements') {
      const file = step.file ?? 'requirements.txt';
      if (!paths.has(`${prefix}${file}`)) {
        throw new Error(`${spec.name} step "python_requirements" needs ${prefix}${file}`);
      }
    }
    if (step.kind === 'external') {
      for (const name of step.serverNames ?? []) {
        if (!serverNames.has(name)) {
          throw new Error(`${spec.name} external step references unknown MCP server "${name}"`);
        }
      }
    }
  }
}

export function generateRegistryV2({ repoRoot, commit, allowDirtyWorktree = false }) {
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(`Expected a full 40-hex commit, got "${commit}"`);
  }
  if (spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: repoRoot }).status !== 0) {
    throw new Error(`Commit ${commit} does not exist in this repository`);
  }
  if (!isCommitOnOrigin(repoRoot, commit)) {
    throw new Error(
      `Commit ${commit} is not reachable from any refs/remotes/origin ref. Push it before publishing the registry.`,
    );
  }
  const dirty = gitCapture(repoRoot, ['status', '--porcelain']).trim();
  if (dirty && !allowDirtyWorktree) {
    throw new Error(
      'Working tree is dirty. Commit and push your changes, or pass --allow-dirty-worktree ' +
        '(digests are still read from the pinned commit, never from the working tree).',
    );
  }

  const legacy = JSON.parse(gitCapture(repoRoot, ['show', `${commit}:registry.json`]));
  const legacyByName = new Map(legacy.plugins.map((plugin) => [plugin.name, plugin]));

  const plugins = [];
  for (const spec of [...PLUGIN_SPECS].sort((a, b) => a.name.localeCompare(b.name))) {
    const manifest = readManifest(repoRoot, commit, spec.path);
    if (manifest.name !== spec.name) {
      throw new Error(`plugin.json at ${spec.path} declares name "${manifest.name}"`);
    }
    const entries = readPluginTreeEntries(repoRoot, commit, spec.path);
    validateSteps(spec.steps, entries, manifest, spec);

    const legacyEntry = legacyByName.get(spec.name) ?? {};
    plugins.push({
      name: spec.name,
      display_name: legacyEntry.display_name ?? spec.name,
      description: legacyEntry.description ?? '',
      category: legacyEntry.category ?? 'uncategorized',
      keywords: legacyEntry.keywords ?? [],
      repo: 'kaisersong/kai-xiaok-plugins',
      path: spec.path,
      version: manifest.version,
      ...(Array.isArray(manifest.platforms) ? { platforms: manifest.platforms } : {}),
      source: {
        commit,
        treeSha256: computeGitTreeSha256(entries),
      },
      install: {
        steps: spec.steps.map((step) => ({ ...step, cwd: step.cwd ?? '.' })),
      },
    });
  }

  return { version: 2, repo: 'kaisersong/kai-xiaok-plugins', plugins };
}

function main(argv) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const args = argv.slice(2);
  const check = args.includes('--check');
  const allowDirtyWorktree = args.includes('--allow-dirty-worktree');
  const commitIndex = args.indexOf('--commit');
  const commit = commitIndex === -1
    ? gitCapture(repoRoot, ['rev-parse', 'HEAD']).trim()
    : args[commitIndex + 1];

  const registry = generateRegistryV2({ repoRoot, commit, allowDirtyWorktree });
  const serialized = `${JSON.stringify(registry, null, 2)}\n`;
  const outputPath = join(repoRoot, 'registry-v2.json');

  if (check) {
    let current = '';
    try {
      current = readFileSync(outputPath, 'utf8');
    } catch {
      console.error('registry-v2.json is missing; run scripts/update-registry-v2.mjs');
      process.exitCode = 1;
      return;
    }
    if (current !== serialized) {
      console.error('registry-v2.json is stale; re-run scripts/update-registry-v2.mjs');
      process.exitCode = 1;
      return;
    }
    console.log(`registry-v2.json is up to date at ${commit}`);
    return;
  }

  writeFileSync(outputPath, serialized, 'utf8');
  console.log(`Wrote registry-v2.json for ${registry.plugins.length} plugins at ${commit}`);
  if (allowDirtyWorktree) {
    console.log('Note: working tree was dirty; digests were read from the pinned commit only.');
  }
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv);
}
