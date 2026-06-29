import { resolve, dirname, sep } from 'node:path';
import { statSync } from 'node:fs';
import { ManifestGenerator, findModuleFiles, type Package } from '../index.js';
import type { McpServerOptions } from './options.js';

/**
 * Input resolution + a manifest cache shared by the introspection tools. Tools
 * accept `files` (explicit `.ts` paths) and/or `dir` (a directory to scan); both
 * are resolved to a sorted list of absolute paths and validated up front, since
 * `ManifestGenerator` silently skips files that aren't in its program.
 */

/** A bad/empty/missing/escaping input. The dispatcher turns this into a tool `isError` result. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve a tool's `files`/`dir` arguments to a sorted list of absolute `.ts`
 * paths. Requires at least one of the two; throws {@link InputError} for an
 * empty selection, missing files, or — under `--local-only` — a path that
 * escapes the confinement root.
 */
export function resolveInputFiles(args: Record<string, unknown>, opts: McpServerOptions): string[] {
  const out: string[] = [];
  if (Array.isArray(args.files)) {
    for (const f of args.files) if (typeof f === 'string') out.push(resolve(f));
  }
  if (typeof args.dir === 'string') {
    out.push(...findModuleFiles(resolve(args.dir), ['.ts']));
  }
  if (out.length === 0) {
    throw new InputError('Provide at least one of "files" (a list of .ts paths) or "dir" (a directory to scan).');
  }

  const unique = [...new Set(out)].sort();

  if (opts.localOnly) {
    const root = resolve(opts.project ? dirname(opts.project) : process.cwd());
    const escaped = unique.filter((f) => f !== root && !f.startsWith(root + sep));
    if (escaped.length > 0) {
      throw new InputError(`--local-only: refusing to read path(s) outside ${root}: ${escaped.join(', ')}`);
    }
  }

  const missing = unique.filter((f) => !isFile(f));
  if (missing.length > 0) {
    throw new InputError(`Input file(s) not found: ${missing.join(', ')}`);
  }
  return unique;
}

// One Package per resolved file-set, keyed by the sorted path list and
// invalidated when any input's mtime changes. `new ManifestGenerator` builds a
// fresh ts.Program synchronously, so caching keeps repeated reads cheap.
const cache = new Map<string, { mtime: number; pkg: Package }>();

function latestMtime(files: string[]): number {
  let max = 0;
  for (const f of files) {
    try {
      max = Math.max(max, statSync(f).mtimeMs);
    } catch {
      // A file removed between resolution and stat invalidates the entry.
      max = Math.max(max, Number.MAX_SAFE_INTEGER);
    }
  }
  return max;
}

/** Generate (or return a cached) manifest `Package` for a resolved file-set. */
export function manifestFor(files: string[]): Package {
  const key = files.join('\n');
  const mtime = latestMtime(files);
  const hit = cache.get(key);
  if (hit && hit.mtime === mtime) return hit.pkg;
  const pkg = new ManifestGenerator(files).generate();
  cache.set(key, { mtime, pkg });
  return pkg;
}

/** Drop cached manifests for a file-set after a write tool mutates the tree. */
export function invalidateManifest(files: string[]): void {
  cache.delete([...new Set(files.map((f) => resolve(f)))].sort().join('\n'));
}
