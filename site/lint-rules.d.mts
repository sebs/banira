// Types for the plain-ESM lint-rule docs data, so TypeScript consumers (the
// determinism test) can import it under strict mode.

export interface LintRuleExample {
  label: string;
  lines: string[];
}

export interface LintRuleDoc {
  id: string;
  label: string;
  description: string;
  /** HTML rationale ("why it matters"). */
  why: string;
  bad: LintRuleExample;
  good: LintRuleExample;
}

export const lintRules: LintRuleDoc[];
export function lintRuleBody(rule: LintRuleDoc): string;
