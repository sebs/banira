import { lintManifest, formatLintResults, LINT_RULES } from '../../index.js';
import { resolve } from 'path';
import { action } from './run.js';

/**
 * `banira lint <files...>` — audit each component against a subset of the Gold
 * Standard Checklist plus documentation-coverage of its public surface
 * (reflection, overridable `:host` styles, documented events/attributes/parts/
 * slots). Prints a report; `--json` emits structured output. Findings are
 * warnings by default; `--strict` treats them as errors and exits non-zero for CI.
 */
export const lint = action(
  'Failed to lint',
  async (
    files: string[],
    options: { json?: boolean; strict?: boolean; rules?: string } = {}
  ) => {
    const ruleIds = options.rules?.split(',').map((r) => r.trim()).filter(Boolean);
    const lintOptions = ruleIds?.length ? { rules: ruleIds } : {};
    const results = await lintManifest(files.map((f) => resolve(f)), lintOptions);

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(formatLintResults(results));
    }

    const hasError = results.some((r) => r.issues.some((i) => i.severity === 'error'));
    const hasWarning = results.some((r) => r.issues.length > 0);
    if (hasError || (options.strict && hasWarning)) process.exit(1);
  }
);

/** Exposed for the CLI help text. */
export const lintRuleList = (): string => LINT_RULES.map((r) => `  ${r.id} — ${r.description}`).join('\n');
