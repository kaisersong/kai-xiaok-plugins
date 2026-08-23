#!/usr/bin/env node
/**
 * vendor-runtimes.mjs — materialise pinned self-contained interpreter closures
 * for the reserved providers (slide renderer Python, report renderer Node).
 *
 * Why this exists: today slide resolves `python3` (redirected to the shared
 * mutable venv via XIAOK_PYTHON_CMD) and report runs on `process.execPath`
 * (Electron's Node). Both interpreters are externally replaceable, so a pinned
 * plugin source generation can still end up executing different code. This
 * script produces a per-target closure that ships inside the plugin, plus an
 * immutable manifest whose canonical Merkle digest lets packaging and runtime
 * re-verify byte identity.
 *
 * Usage:
 *   node scripts/vendor-runtimes.mjs                       # all runtimes, all targets
 *   node scripts/vendor-runtimes.mjs --runtime report-node --target darwin-arm64
 *   node scripts/vendor-runtimes.mjs --verify               # re-verify manifests only
 *   node scripts/vendor-runtimes.mjs --offline              # fail instead of downloading
 *
 * Inputs are pinned in runtime-lock.json (url + sha256 per target). Nothing is
 * resolved from PATH; nothing is downloaded at Desktop runtime.
 */

import { createHash } from 'node:crypto';
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync,
  readdirSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const LOCK_PATH = join(REPO_ROOT, 'runtime-lock.json');
const MERKLE_SCHEMA = 'xiaok-canonical-tree-merkle-v1';

function parseArgs(argv) {
  const out = { runtime: 'all', target: 'all', verify: false, offline: false, cache: join(tmpdir(), 'xiaok-runtime-cache') };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--verify') out.verify = true;
    else if (a === '--offline') out.offline = true;
    else if (a === '--runtime') out.runtime = argv[++i];
    else if (a === '--target') out.target = argv[++i];
    else if (a === '--cache') out.cache = resolve(argv[++i]);
    else if (a === '--root') out.root = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  }
  return r.stdout ?? '';
}

/* ---------- canonical tree merkle (no-follow, tagged union) ----------
 *
 * Scope of the guarantee: the digest covers path, mode, size and content of
 * every entry, so it detects any drift in a closure between the moment it was
 * materialised and the moment packaging consumes it — that is what caught venv
 * creation writing bytecode back into the closure.
 *
 * It is deliberately NOT a cross-host reproducibility proof. File modes come
 * from the OS that extracted the archive, so the same target materialised on
 * macOS (644/755) and on Windows (Windows has no POSIX modes) yields the same
 * entry set but different digests. Byte-exactness of the *inputs* is what
 * runtime-lock.json pins, via the SHA-256 of each downloaded archive.
 */

function walkCanonical(root) {
  const entries = [];
  const visit = (absDir) => {
    for (const name of readdirSync(absDir).sort()) {
      const abs = join(absDir, name);
      const rel = relative(root, abs).split(sep).join(posix.sep);
      const st = lstatSync(abs);
      const mode = (st.mode & 0o7777).toString(8).padStart(4, '0');
      if (st.isDirectory()) {
        entries.push({ kind: 'directory', path: rel, mode });
        visit(abs);
      } else if (st.isSymbolicLink()) {
        const rawTarget = readlinkSync(abs, { encoding: 'buffer' });
        const normalizedTarget = readlinkSync(abs).split(sep).join(posix.sep);
        const resolved = resolve(dirname(abs), normalizedTarget);
        if (relative(root, resolved).startsWith('..')) {
          throw new Error(`symlink escapes runtime root: ${rel} -> ${normalizedTarget}`);
        }
        entries.push({
          kind: 'symlink',
          path: rel,
          mode,
          rawTargetBytesSha256: createHash('sha256').update(rawTarget).digest('hex'),
          normalizedTarget,
        });
      } else if (st.isFile()) {
        if (st.nlink > 1) throw new Error(`hardlink (nlink=${st.nlink}) rejected: ${rel}`);
        entries.push({ kind: 'file', path: rel, mode, size: st.size, sha256: sha256File(abs) });
      } else {
        throw new Error(`special filesystem node rejected: ${rel}`);
      }
    }
  };
  visit(root);
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return entries;
}

function merkleRoot(entries) {
  const h = createHash('sha256');
  h.update(`${MERKLE_SCHEMA}\n${entries.length}\n`);
  for (const e of entries) {
    const canonical = e.kind === 'file'
      ? `file\u0000${e.path}\u0000${e.mode}\u0000${e.size}\u0000${e.sha256}`
      : e.kind === 'symlink'
        ? `symlink\u0000${e.path}\u0000${e.mode}\u0000${e.rawTargetBytesSha256}\u0000${e.normalizedTarget}`
        : `directory\u0000${e.path}\u0000${e.mode}`;
    h.update(`${canonical}\n`);
  }
  return h.digest('hex');
}

/* ---------- acquisition ---------- */

function ensureArchive(target, cacheDir, offline) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, target.url.split('/').pop());
  if (existsSync(file) && sha256File(file) === target.sha256) return file;
  if (offline) throw new Error(`missing or stale cached archive in --offline mode: ${file}`);
  process.stdout.write(`  downloading ${target.url}\n`);
  run('curl', ['-fsSL', '--max-time', '900', '-o', file, target.url]);
  const digest = sha256File(file);
  if (digest !== target.sha256) {
    rmSync(file, { force: true });
    throw new Error(`sha256 mismatch for ${target.url}\n  expected ${target.sha256}\n  actual   ${digest}`);
  }
  return file;
}

function extractArchive(archivePath, kind, into) {
  mkdirSync(into, { recursive: true });
  if (kind === 'tar.gz') run('tar', ['xzf', archivePath, '-C', into]);
  else if (kind === 'zip') run('unzip', ['-q', archivePath, '-d', into]);
  else throw new Error(`unsupported archive kind: ${kind}`);
}

function pruneToKeepOnly(rootDir, keepOnly) {
  const keep = new Set(keepOnly.map((p) => p.split('/').join(sep)));
  const keepDirs = new Set();
  for (const k of keep) {
    let d = dirname(k);
    while (d && d !== '.' && d !== sep) { keepDirs.add(d); d = dirname(d); }
  }
  const visit = (absDir) => {
    for (const name of readdirSync(absDir)) {
      const abs = join(absDir, name);
      const rel = relative(rootDir, abs);
      const st = lstatSync(abs);
      if (st.isDirectory()) {
        if (keep.has(rel)) continue;
        if (keepDirs.has(rel)) { visit(abs); continue; }
        rmSync(abs, { recursive: true, force: true });
      } else if (!keep.has(rel)) {
        rmSync(abs, { force: true });
      }
    }
  };
  visit(rootDir);
  for (const k of keep) {
    if (!existsSync(join(rootDir, k))) throw new Error(`keepOnly entry missing after extract: ${k}`);
  }
}

/**
 * Drop non-essential files (e.g. Windows `.pdb` debug symbols) that are not part
 * of the executable/stdlib closure. Only suffix globs of the form `** /*.ext` are
 * supported so the rule stays auditable.
 */
function dropByGlobs(rootDir, globs) {
  const suffixes = globs.map((g) => {
    const m = g.match(/^\*\*\/\*(\.[A-Za-z0-9._-]+)$/);
    if (!m) throw new Error(`unsupported dropGlob (expected "**/*.ext"): ${g}`);
    return m[1];
  });
  let dropped = 0;
  const visit = (absDir) => {
    for (const name of readdirSync(absDir)) {
      const abs = join(absDir, name);
      const st = lstatSync(abs);
      if (st.isDirectory()) visit(abs);
      else if (suffixes.some((s) => name.endsWith(s))) { rmSync(abs, { force: true }); dropped += 1; }
    }
  };
  visit(rootDir);
  process.stdout.write(`  dropped ${dropped} file(s) matching ${globs.join(', ')}\n`);
}

/**
 * Remove an explicit, auditable list of paths that are not part of the runtime
 * closure this provider needs (headers, static libs, Tk/IDLE, base pip, test
 * suites). Every entry is an exact relative path — no globs — so the release
 * diff shows precisely what was dropped. The real render/tools-list smoke is
 * what proves the remaining closure is still complete.
 */
function prunePathList(rootDir, paths) {
  let removed = 0;
  const missing = [];
  for (const rel of paths) {
    const abs = join(rootDir, rel.split('/').join(sep));
    if (!existsSync(abs)) { missing.push(rel); continue; }
    rmSync(abs, { recursive: true, force: true });
    removed += 1;
  }
  process.stdout.write(`  pruned ${removed}/${paths.length} declared path(s)${missing.length ? `, absent: ${missing.join(', ')}` : ''}\n`);
}

/**
 * Removes every directory with one of the given names anywhere in the closure.
 * Used for `__pycache__`: those files are regenerated bytecode, not code that the
 * dynamic loader maps, and shipping them means codesign has to sign hundreds of
 * data files inside the app bundle (a real `pack:dir` failure). Reserved children
 * run with PYTHONDONTWRITEBYTECODE=1, so nothing rewrites them at runtime either.
 */
function dropDirsByName(rootDir, names) {
  let removed = 0;
  const visit = (absDir) => {
    for (const name of readdirSync(absDir)) {
      const abs = join(absDir, name);
      if (!lstatSync(abs).isDirectory()) continue;
      if (names.includes(name)) {
        rmSync(abs, { recursive: true, force: true });
        removed += 1;
        continue;
      }
      visit(abs);
    }
  };
  visit(rootDir);
  process.stdout.write(`  dropped ${removed} directory(ies) named ${names.join(', ')}\n`);
}

/** Keep only the named entries inside the closure's `bin`/`Scripts` dir. */
function pruneBinDir(rootDir, spec) {
  const dir = join(rootDir, spec.dir.split('/').join(sep));
  if (!existsSync(dir)) return;
  const keep = new Set(spec.keep);
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (keep.has(name)) continue;
    rmSync(join(dir, name), { recursive: true, force: true });
    removed += 1;
  }
  for (const name of spec.keep) {
    if (!existsSync(join(dir, name))) throw new Error(`required ${spec.dir} entry missing after prune: ${name}`);
  }
  process.stdout.write(`  pruned ${removed} entr(ies) from ${spec.dir}, kept ${spec.keep.join(', ')}\n`);
}

/**
 * Strip local symbol tables from Mach-O binaries. Only ever applied when the
 * target equals the build host, so a cross-target closure is never touched by a
 * host toolchain.
 */
function stripHostBinaries(rootDir, relPaths) {
  for (const rel of relPaths) {
    const abs = join(rootDir, rel.split('/').join(sep));
    if (!existsSync(abs)) throw new Error(`strip target missing: ${rel}`);
    const before = statSync(abs).size;
    run('strip', ['-x', abs]);
    const after = statSync(abs).size;
    process.stdout.write(`  stripped ${rel}: ${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB\n`);
  }
}

/* ---------- dynamic dependency check (host target only) ---------- */
function checkMachOClosure(rootDir, launcherAbs, rule) {
  const out = run('otool', ['-L', launcherAbs]);
  const bad = [];
  for (const line of out.split('\n').slice(1)) {
    const m = line.trim().match(/^(\S+)\s+\(compatibility/);
    if (!m) continue;
    const dep = m[1];
    if (dep.startsWith('@')) continue; // @rpath/@loader_path resolved inside the closure
    const isSystem = rule.allowedSystemPrefixes.some((p) => dep.startsWith(p));
    const insideRoot = !relative(rootDir, resolve(dep)).startsWith('..');
    if (!isSystem && !insideRoot) bad.push(dep);
  }
  if (bad.length) throw new Error(`launcher escapes runtime root via dynamic deps: ${bad.join(', ')}`);
  return out.split('\n').length - 1;
}

/* ---------- manifest ---------- */

function buildManifest(runtimeKey, runtime, targetKey, target, rootDir, extra) {
  const entries = walkCanonical(rootDir);
  const [platform, arch] = targetKey.split('-');
  return {
    schema: runtime.manifestSchema,
    runtimeKey,
    plugin: runtime.plugin,
    target: targetKey,
    platform,
    arch,
    implementation: runtime.implementation,
    version: target.version,
    ...(target.abi ? { abi: target.abi } : {}),
    ...(target.moduleAbi ? { moduleAbi: target.moduleAbi } : {}),
    launcherRelativePath: target.launcherRelativePath,
    ...(target.stdlibRoots ? { stdlibRoots: target.stdlibRoots } : {}),
    ...(target.extensionRoots ? { extensionRoots: target.extensionRoots } : {}),
    dynamicDependencyRule: target.dynamicDependencyRule,
    // The explicit, glob-free prune list is part of the artifact contract: any
    // add/remove changes this manifest and therefore the runtime contract digest.
    prune: {
      paths: target.prunePaths ?? [],
      binDir: target.keepBinDirEntries ?? null,
      strippedHostBinaries: target.stripHostBinaries ?? [],
    },
    upstream: { source: runtime.upstream, url: target.url, sha256: target.sha256, ...(target.upstreamTag ? { tag: target.upstreamTag } : {}) },
    merkle: { schema: MERKLE_SCHEMA, entryCount: entries.length, root: merkleRoot(entries) },
    verifiedOnHost: extra.verifiedOnHost,
    entries,
  };
}

function targetRoot(runtime, targetKey) {
  return join(REPO_ROOT, 'plugins', runtime.plugin, runtime.destDir, targetKey);
}

/* ---------- commands ---------- */

function materialise(runtimeKey, runtime, targetKey, target, opts) {
  const dest = targetRoot(runtime, targetKey);
  process.stdout.write(`[${runtimeKey}/${targetKey}] materialising\n`);
  const archive = ensureArchive(target, opts.cache, opts.offline);
  const staging = mkdtempSync(join(tmpdir(), 'xiaok-runtime-stage-'));
  try {
    extractArchive(archive, target.archive, staging);
    const extracted = join(staging, target.archiveRoot);
    if (!existsSync(extracted)) throw new Error(`archive root not found after extract: ${target.archiveRoot}`);
    if (target.keepOnly) pruneToKeepOnly(extracted, target.keepOnly);
    if (target.dropGlobs) dropByGlobs(extracted, target.dropGlobs);

    // Interpreter closure always lands under a fixed `<target>/<implementation dir>`
    // so launcherRelativePath in the lock stays stable across upstream layouts.
    const closureDirName = runtime.implementation === 'node' ? 'node' : 'python';
    const closure = join(staging, '__closure__', closureDirName);
    mkdirSync(dirname(closure), { recursive: true });
    cpSync(extracted, closure, { recursive: true, verbatimSymlinks: true });

    // Prune/strip run on the closure root, so every declared path in the lock is
    // relative to `<python|node>/…` exactly as it will ship.
    const closureRoot = join(staging, '__closure__');
    if (target.dropDirNames) dropDirsByName(closureRoot, target.dropDirNames);
    if (target.prunePaths) prunePathList(closureRoot, target.prunePaths);
    if (target.keepBinDirEntries) pruneBinDir(closureRoot, target.keepBinDirEntries);

    const launcherAbs = join(staging, '__closure__', target.launcherRelativePath);
    if (!existsSync(launcherAbs)) throw new Error(`launcher missing: ${target.launcherRelativePath}`);
    chmodSync(launcherAbs, 0o755);

    const hostTarget = `${process.platform}-${process.arch}`;
    if (targetKey === hostTarget && target.stripHostBinaries) {
      stripHostBinaries(join(staging, '__closure__'), target.stripHostBinaries);
    }
    const verifiedOnHost = { target: hostTarget, launcherRan: false, dynamicDepsChecked: false };
    if (targetKey === hostTarget) {
      const probe = runtime.implementation === 'node'
        ? run(launcherAbs, ['-p', 'process.versions.node + " " + process.versions.modules'])
        : run(launcherAbs, ['-I', '-B', '-c', 'import sys;print(sys.version.split()[0], sys.base_prefix)'], {
          // Never let a probe write bytecode back into the closure: the manifest
          // digest is computed right after this and must stay reproducible.
          env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1' },
        });
      verifiedOnHost.launcherRan = true;
      verifiedOnHost.probe = probe.trim();
      if (!probe.includes(target.version)) {
        throw new Error(`launcher version mismatch: lock says ${target.version}, probe said "${probe.trim()}"`);
      }
      if (target.moduleAbi && !probe.split(/\s+/).includes(String(target.moduleAbi))) {
        throw new Error(`moduleAbi mismatch: lock says ${target.moduleAbi}, probe said "${probe.trim()}"`);
      }
      if (target.dynamicDependencyRule.tool === 'otool -L') {
        checkMachOClosure(join(staging, '__closure__'), launcherAbs, target.dynamicDependencyRule);
        verifiedOnHost.dynamicDepsChecked = true;
      }
    }

    const manifest = buildManifest(runtimeKey, runtime, targetKey, target, join(staging, '__closure__'), { verifiedOnHost });

    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(staging, '__closure__'), dest, { recursive: true, verbatimSymlinks: true });
    writeFileSync(join(dest, runtime.manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
    process.stdout.write(
      `  ok: ${manifest.merkle.entryCount} entries, merkle ${manifest.merkle.root.slice(0, 16)}…`
      + `${verifiedOnHost.launcherRan ? `, probe "${verifiedOnHost.probe}"` : ', cross-target (not executed)'}\n`,
    );
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function verify(runtimeKey, runtime, targetKey, overrideRoot) {
  const dest = overrideRoot ?? targetRoot(runtime, targetKey);
  const mPath = join(dest, runtime.manifestName);
  if (!existsSync(mPath)) throw new Error(`manifest missing: ${relative(REPO_ROOT, mPath)}`);
  const manifest = JSON.parse(readFileSync(mPath, 'utf8'));
  const entries = walkCanonical(dest).filter((e) => e.path !== runtime.manifestName);
  const root = merkleRoot(entries);
  if (entries.length !== manifest.merkle.entryCount || root !== manifest.merkle.root) {
    throw new Error(
      `merkle mismatch for ${runtimeKey}/${targetKey}\n`
      + `  manifest: ${manifest.merkle.entryCount} entries ${manifest.merkle.root}\n`
      + `  actual:   ${entries.length} entries ${root}`,
    );
  }
  const launcher = join(dest, manifest.launcherRelativePath);
  if (!existsSync(launcher)) throw new Error(`launcher missing: ${manifest.launcherRelativePath}`);
  if (!statSync(launcher).isFile()) throw new Error(`launcher is not a regular file: ${manifest.launcherRelativePath}`);
  process.stdout.write(`[${runtimeKey}/${targetKey}] verified: ${entries.length} entries, merkle ${root.slice(0, 16)}…\n`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  const runtimeKeys = opts.runtime === 'all' ? Object.keys(lock.runtimes) : [opts.runtime];
  let count = 0;
  for (const runtimeKey of runtimeKeys) {
    const runtime = lock.runtimes[runtimeKey];
    if (!runtime) throw new Error(`unknown runtime: ${runtimeKey}`);
    const targetKeys = opts.target === 'all' ? Object.keys(runtime.targets) : [opts.target];
    for (const targetKey of targetKeys) {
      const target = runtime.targets[targetKey];
      if (!target) throw new Error(`unknown target for ${runtimeKey}: ${targetKey}`);
      if (opts.verify) verify(runtimeKey, runtime, targetKey, opts.root);
      else {
        if (opts.root) throw new Error('--root is only supported with --verify');
        materialise(runtimeKey, runtime, targetKey, target, opts);
      }
      count += 1;
    }
  }
  process.stdout.write(`${opts.verify ? 'verified' : 'materialised'} ${count} runtime target(s)\n`);
}

main();
