import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { lintManifest, formatLintResults, LINT_RULES } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (f: string) => resolve(__dirname, 'fixtures', f);

const rulesOf = (issues: { rule: string }[]) => new Set(issues.map((i) => i.rule));

describe('lintManifest — Gold Standard + doc coverage (issues #38, #41)', () => {
    it('flags the full set of gaps on a component that has them', async () => {
        const [result] = await lintManifest([fixture('lint-element.ts')]);
        const rules = rulesOf(result!.issues);
        assert.ok(rules.has('host-overridable'), ':host !important should be flagged');
        assert.ok(rules.has('undocumented-event'), 'dispatched-but-undocumented event');
        assert.ok(rules.has('undocumented-attribute'), 'attribute without jsdoc');
        assert.ok(rules.has('undocumented-part'), 'exposed part without @csspart');
        assert.ok(rules.has('undocumented-slot'), 'rendered slot without @slot');
    });

    it('reports nothing for a fully-documented, overridable component', async () => {
        const [result] = await lintManifest([fixture('lint-clean.ts')]);
        assert.deepStrictEqual(result!.issues, []);
    });

    it('flags attribute↔property reflection gaps via the reflection rule', async () => {
        const [result] = await lintManifest([fixture('reflect-element.ts')]);
        const reflection = result!.issues.filter((i) => i.rule === 'reflection');
        assert.ok(reflection.length >= 1);
        assert.ok(reflection.every((i) => i.message.includes('oneway')));
    });

    it('runs only the requested rules', async () => {
        const [result] = await lintManifest([fixture('lint-element.ts')], { rules: ['undocumented-part'] });
        assert.deepStrictEqual([...rulesOf(result!.issues)], ['undocumented-part']);
    });

    it('exposes the rule catalogue', () => {
        assert.ok(LINT_RULES.some((r) => r.id === 'reflection' && r.description.length > 0));
    });
});

describe('formatLintResults', () => {
    it('prints an OK line for clean elements and a per-rule report otherwise', async () => {
        const results = await lintManifest([fixture('lint-element.ts'), fixture('lint-clean.ts')]);
        const report = formatLintResults(results);
        assert.match(report, /OK\s+<lint-clean>/);
        assert.match(report, /<lint-element>/);
        assert.match(report, /warn\s+undocumented-event:/);
        assert.match(report, /2 element\(s\), 0 error\(s\), \d+ warning\(s\)/);
    });
});
