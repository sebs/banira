import { smokeTestManifest, formatSmokeResults } from '../../index.js';
import { resolve } from 'path';
import { action } from './run.js';

/**
 * `banira test <files...>` — manifest-driven smoke test. For every custom
 * element found in the sources, compile, mount it in JSDOM, and assert it
 * registers and upgrades. Exits 1 if any element fails. With `--reflection`
 * and/or `--slots`, also runs the (advisory) attribute↔property reflection and
 * slot-contract checks and prints any warnings.
 */
export const test = action(
  'Failed to run smoke tests',
  async (files: string[], options: { reflection?: boolean; slots?: boolean } = {}) => {
    const smokeOptions: { reflection?: boolean; slots?: boolean } = {};
    if (options.reflection) smokeOptions.reflection = true;
    if (options.slots) smokeOptions.slots = true;
    const results = await smokeTestManifest(files.map((f) => resolve(f)), smokeOptions);
    console.log(formatSmokeResults(results));
    if (results.some((r) => !r.ok)) process.exit(1);
  }
);
