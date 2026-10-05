import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { measureComponents, toBudgetBaseline, checkBudget, formatCosts } from '../src/index.js';
import type { ComponentCost, BudgetBaseline } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const circle = resolve(__dirname, '../examples/my-circle/my-circle.ts');
const styledBox = resolve(__dirname, 'fixtures/css/styled-box.ts');

const cost = (overrides: Partial<ComponentCost> = {}): ComponentCost => ({
    tagName: 'x-el',
    file: '/x-el.ts',
    raw: 1000,
    gzip: 400,
    renderMs: 2,
    ...overrides,
});

describe('measureComponents (issue #45)', () => {
    it('reports raw + gzip emitted size and a first-render time per element', async () => {
        const [c] = await measureComponents([circle]);
        assert.strictEqual(c!.tagName, 'my-circle');
        assert.ok(c!.raw > 0 && c!.gzip > 0 && c!.gzip < c!.raw, `raw ${c!.raw}, gzip ${c!.gzip}`);
        assert.strictEqual(typeof c!.renderMs, 'number');
        assert.ok(c!.renderMs! >= 0);
        assert.strictEqual(c!.error, undefined);
    });

    it('counts lowered CSS in the emitted size and can skip render timing', async () => {
        const [c] = await measureComponents([styledBox], { render: false });
        const css = readFileSync(resolve(__dirname, 'fixtures/css/box.css'), 'utf8').trim();
        assert.ok(c!.raw > Buffer.byteLength(css), 'the inlined stylesheet is part of the shipped bytes');
        assert.strictEqual(c!.renderMs, undefined);
    });
});

describe('checkBudget (issue #45)', () => {
    const baseline: BudgetBaseline = toBudgetBaseline([cost()]);

    it('builds a baseline keyed by tag name', () => {
        assert.deepStrictEqual(baseline, { components: { 'x-el': { raw: 1000, gzip: 400, renderMs: 2 } } });
    });

    it('passes growth within the threshold and flags growth beyond it', () => {
        assert.deepStrictEqual(checkBudget([cost({ raw: 1100, gzip: 440 })], baseline), []);
        assert.deepStrictEqual(checkBudget([cost({ gzip: 441 })], baseline), [
            { tagName: 'x-el', metric: 'gzip', baseline: 400, current: 441 },
        ]);
        assert.strictEqual(checkBudget([cost({ gzip: 441 })], baseline, { threshold: 0.5 }).length, 0);
    });

    it('ignores render regressions under the slack, but not over it', () => {
        assert.deepStrictEqual(checkBudget([cost({ renderMs: 2.9 })], baseline), []);
        assert.deepStrictEqual(checkBudget([cost({ renderMs: 3.5 })], baseline), [
            { tagName: 'x-el', metric: 'renderMs', baseline: 2, current: 3.5 },
        ]);
    });

    it('does not flag elements missing from the baseline', () => {
        assert.deepStrictEqual(checkBudget([cost({ tagName: 'new-el', raw: 9999 })], baseline), []);
    });

    it('throws on a malformed baseline', () => {
        assert.throws(() => checkBudget([cost()], {} as BudgetBaseline), /malformed/);
    });

    it('formats the report with the verdict and new elements', () => {
        const { renderMs: _unused, ...unrendered } = cost({ tagName: 'new-el' });
        const costs = [cost({ gzip: 500 }), unrendered];
        const report = formatCosts(costs, { violations: checkBudget(costs, baseline), baseline, threshold: 0.1 });
        assert.match(report, /SIZE <x-el> {2}1000 B raw · 500 B gzip · first render 2 ms/);
        assert.match(report, /SIZE <new-el> .*\(new, not in baseline\)/);
        assert.match(report, /Budget exceeded \(threshold 10%\):\n {2}FAIL <x-el> gzip 400 B → 500 B \(\+25%\)/);
        assert.match(formatCosts([cost()], { violations: [], baseline }), /Within budget \(threshold 10%\)\./);
    });
});
