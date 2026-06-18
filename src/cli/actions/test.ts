import { smokeTestManifest, formatSmokeResults } from '../../index.js';
import { resolve } from 'path';
import { action } from './run.js';

/**
 * `banira test <files...>` — manifest-driven smoke test. For every custom
 * element found in the sources, compile, mount it in JSDOM, and assert it
 * registers and upgrades. Exits 1 if any element fails.
 */
export const test = action(
  'Failed to run smoke tests',
  async (files: string[], _options: Record<string, unknown> = {}) => {
    const results = await smokeTestManifest(files.map((f) => resolve(f)));
    console.log(formatSmokeResults(results));
    if (results.some((r) => !r.ok)) process.exit(1);
  }
);
