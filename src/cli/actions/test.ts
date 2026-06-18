import { smokeTestManifest, formatSmokeResults } from '../../index.js';
import { resolve } from 'path';

/**
 * `banira test <files...>` — manifest-driven smoke test. For every custom
 * element found in the sources, compile, mount it in JSDOM, and assert it
 * registers and upgrades. Exits 1 if any element fails.
 */
export const test = async (files: string[], _options: Record<string, unknown> = {}) => {
  try {
    const results = await smokeTestManifest(files.map((f) => resolve(f)));
    console.log(formatSmokeResults(results));
    if (results.some((r) => !r.ok)) process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to run smoke tests: ${message}`);
    process.exit(1);
  }
};
