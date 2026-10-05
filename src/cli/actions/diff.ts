import { diffManifests, formatManifestDiff, formatChangelog } from '../../index.js';
import type { Package } from '../../index.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { action, emit } from './run.js';

/**
 * `banira diff <baseline> <current>` — compare two Custom Elements Manifest
 * JSON files and report API changes with a suggested semver release type.
 * Prints a human-readable report, or JSON with `--json`. `--changelog` renders
 * a paste-ready Markdown changelog block instead, printed or written to a file.
 */
export const diff = action(
  'Failed to diff manifests',
  async (
    baseline: string,
    current: string,
    options: { json?: boolean; changelog?: boolean | string; heading?: string } = {}
  ) => {
    const before = JSON.parse(await readFile(resolve(baseline), 'utf8')) as Package;
    const after = JSON.parse(await readFile(resolve(current), 'utf8')) as Package;
    const result = diffManifests(before, after);

    if (options.changelog) {
      const outputPath = typeof options.changelog === 'string' ? options.changelog : undefined;
      const outPath = await emit(formatChangelog(result, options.heading ? { heading: options.heading } : {}), outputPath);
      if (outPath) console.log(`Changelog (${result.release}) written to ${outPath}`);
      return;
    }

    console.log(options.json ? JSON.stringify(result, null, 2) : formatManifestDiff(result));
  }
);
