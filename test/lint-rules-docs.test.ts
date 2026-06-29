import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LINT_RULES, ruleDocsUrl, LINT_DOCS_BASE } from '../src/index.js';
// The website's per-rule documentation data (plain ESM, shared with build.mjs).
import { lintRules } from '../site/lint-rules.mjs';

describe('lint rule documentation', () => {
  it('documents exactly the rules in LINT_RULES (ids in sync)', () => {
    const ruleIds = LINT_RULES.map((r) => r.id).sort();
    const docIds = lintRules.map((r) => r.id).sort();
    assert.deepStrictEqual(docIds, ruleIds, 'site/lint-rules.mjs ids must match LINT_RULES');
  });

  it('derives a deterministic docs URL that ends with the rule id', () => {
    for (const { id } of LINT_RULES) {
      const url = ruleDocsUrl(id);
      assert.strictEqual(url, `${LINT_DOCS_BASE}/${id}`);
      assert.ok(url.endsWith(`/${id}`), `URL for "${id}" should end with the id: ${url}`);
    }
  });

  it('gives every rule a flagged (bad) and a good example', () => {
    for (const rule of lintRules) {
      assert.ok(rule.description, `${rule.id} needs a description`);
      assert.ok(rule.why.includes('<p>'), `${rule.id} needs a rationale`);
      assert.ok(rule.bad?.lines?.length, `${rule.id} needs a flagged example`);
      assert.ok(rule.good?.lines?.length, `${rule.id} needs a good example`);
    }
  });
});
