import { diffManifests, formatManifestDiff } from '../../index.js';
import type { Package } from '../../index.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * `banira diff <baseline> <current>` — compare two Custom Elements Manifest
 * JSON files and report API changes with a suggested semver release type.
 * Prints a human-readable report, or JSON with `--json`.
 */
export const diff = async (baseline: string, current: string, options: { json?: boolean } = {}) => {
  try {
    const before = JSON.parse(await readFile(resolve(baseline), 'utf8')) as Package;
    const after = JSON.parse(await readFile(resolve(current), 'utf8')) as Package;
    const result = diffManifests(before, after);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatManifestDiff(result));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to diff manifests: ${message}`);
    process.exit(1);
  }
};
