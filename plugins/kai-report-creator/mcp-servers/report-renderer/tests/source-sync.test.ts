import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe('formal report upstream sync', () => {
  it('binds a complete byte-exact reference/theme closure', () => {
    const manifest = json(join(root, 'vendor-manifest.json'));
    expect(manifest.source).toBe('report-creator');
    expect(manifest.source_version).toBe('1.28.1');
    expect(manifest.source_commit).toMatch(/^[a-f0-9]{40}$/);
    const paths = ['references', 'themes'].flatMap(folder =>
      readdirSync(join(root, folder), { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => resolve(entry.parentPath, entry.name).slice(root.length + 1)));
    expect(Object.keys(manifest.files).sort()).toEqual(paths.sort());
    for (const [path, hash] of Object.entries(manifest.files)) {
      expect(createHash('sha256').update(readFileSync(join(root, path))).digest('hex')).toBe(hash);
    }
  });
  it('aligns adapter, planner and legacy registry versions', () => {
    const manifest = json(join(root, 'plugin.json'));
    expect(json(join(root, 'mcp-servers/report-renderer/package.json')).version).toBe(manifest.version);
    expect(readFileSync(join(root, 'skills/report-planner/SKILL.md'), 'utf8')).toContain(`version: ${manifest.version}`);
    expect(json(join(root, '../../registry.json')).plugins.find((entry: {name: string}) => entry.name === manifest.name).version).toBe(manifest.version);
  });
  it('retains upstream forest-editorial timeline capsule padding', () => {
    const css = readFileSync(join(root, 'mcp-servers/report-renderer/src/themes/css/forest-editorial.css'), 'utf8');
    expect(css.match(/\.timeline-content\s*\{[^}]*padding:\s*([^;]+);/)?.[1]).toBe('.75rem 1.1rem');
  });
});
