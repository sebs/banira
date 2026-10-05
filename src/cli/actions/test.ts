import {
  smokeTestManifest,
  formatSmokeResults,
  measureComponents,
  toBudgetBaseline,
  checkBudget,
  formatCosts,
} from '../../index.js';
import type { BudgetBaseline } from '../../index.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { action, emit } from './run.js';

export interface TestOptions {
  reflection?: boolean;
  slots?: boolean;
  /** Also report each element's emitted size and first-render time. */
  size?: boolean;
  /** Baseline JSON to compare the measurement against (implies `size`). */
  budget?: string;
  /** With `budget`: write the current measurement as the baseline instead of comparing. */
  updateBudget?: boolean;
  /** Allowed growth over the baseline in percent (default 10). */
  threshold?: string | number;
}

/**
 * `banira test <files...>` — manifest-driven smoke test. For every custom
 * element found in the sources, compile, mount it in JSDOM, and assert it
 * registers and upgrades. Exits 1 if any element fails. With `--reflection`
 * and/or `--slots`, also runs the (advisory) attribute↔property reflection and
 * slot-contract checks and prints any warnings.
 *
 * With `--size`, also reports each element's emitted size (raw + gzip) and a
 * rough first-render time. `--budget <file>` compares that against a JSON
 * baseline and exits 1 when a metric grew beyond `--threshold` percent;
 * `--update-budget` writes the current measurement as that baseline instead.
 */
export const test = action('Failed to run smoke tests', async (files: string[], options: TestOptions = {}) => {
  const resolved = files.map((f) => resolve(f));
  const smokeOptions: { reflection?: boolean; slots?: boolean } = {};
  if (options.reflection) smokeOptions.reflection = true;
  if (options.slots) smokeOptions.slots = true;
  const results = await smokeTestManifest(resolved, smokeOptions);
  console.log(formatSmokeResults(results));
  let failed = results.some((r) => !r.ok);

  if (options.updateBudget && !options.budget) {
    throw new Error('--update-budget needs a baseline path (use --budget <file>)');
  }
  if (options.size || options.budget) {
    const threshold = Number(options.threshold ?? 10);
    if (!Number.isFinite(threshold) || threshold < 0) {
      throw new Error(`Invalid --threshold "${options.threshold}": expected a non-negative percentage`);
    }
    const costs = await measureComponents(resolved);
    console.log('');

    if (options.budget && options.updateBudget) {
      console.log(formatCosts(costs));
      const outPath = await emit(JSON.stringify(toBudgetBaseline(costs), null, 2), options.budget);
      console.log(`\nBudget baseline written to ${outPath}`);
    } else if (options.budget) {
      let baseline: BudgetBaseline;
      try {
        baseline = JSON.parse(await readFile(resolve(options.budget), 'utf8')) as BudgetBaseline;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not read budget baseline ${options.budget} (${reason}); create it with --update-budget`);
      }
      const violations = checkBudget(costs, baseline, { threshold: threshold / 100 });
      console.log(formatCosts(costs, { violations, baseline, threshold: threshold / 100 }));
      if (violations.length > 0) failed = true;
    } else {
      console.log(formatCosts(costs));
    }
  }

  if (failed) process.exit(1);
});
