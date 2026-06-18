import { diffManifests, formatManifestDiff } from '../../index.js';
import type { Package } from '../../index.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { action } from './run.js';

/**
 * `banira diff <baseline> <current>` — compare two Custom Elements Manifest
 * JSON files and report API changes with a suggested semver release type.
 * Prints a human-readable report, or JSON with `--json`.
 */
export const diff = action(
  'Failed to diff manifests',
  async (baseline: string, current: string, options: { json?: boolean } = {}) => {
    const before = JSON.parse(await readFile(resolve(baseline), 'utf8')) as Package;
    const after = JSON.parse(await readFile(resolve(current), 'utf8')) as Package;
    const result = diffManifests(before, after);

    console.log(options.json ? JSON.stringify(result, null, 2) : formatManifestDiff(result));
  }
);
