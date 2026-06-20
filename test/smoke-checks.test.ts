import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { smokeTestManifest, formatSmokeResults } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (f: string) => resolve(__dirname, 'fixtures', f);

describe('smoke test — reflection round-trip (issue #39)', () => {
    it('flags only the non-reflecting direction, leaving fully-reflected attributes clean', async () => {
        const [result] = await smokeTestManifest([fixture('reflect-element.ts')], { reflection: true });
        assert.strictEqual(result!.ok, true);
        const issues = result!.reflection!;
        // label/count/active reflect both ways; only `oneway` (property→attribute) is broken.
        assert.strictEqual(issues.length, 1);
        assert.deepStrictEqual(
            { attribute: issues[0]!.attribute, direction: issues[0]!.direction },
            { attribute: 'oneway', direction: 'property-to-attribute' }
        );
        assert.ok(!issues.some((i) => ['label', 'count', 'active'].includes(i.attribute)));
    });

    it('does not run (or report) reflection unless asked', async () => {
        const [result] = await smokeTestManifest([fixture('reflect-element.ts')]);
        assert.strictEqual(result!.reflection, undefined);
    });
});

describe('smoke test — slot contracts (issue #40)', () => {
    it('flags declared-but-missing and present-but-undeclared slots', async () => {
        const [result] = await smokeTestManifest([fixture('slot-element.ts')], { slots: true });
        assert.strictEqual(result!.ok, true);
        const byKind = (kind: string) => result!.slots!.filter((s) => s.kind === kind).map((s) => s.slot);
        assert.deepStrictEqual(byKind('missing'), ['missing']);
        assert.deepStrictEqual(byKind('undeclared'), ['extra']);
        // the default and `icon` slots project sample content → no 'unassigned' issues
        assert.deepStrictEqual(byKind('unassigned'), []);
    });

    it('does not run (or report) slots unless asked', async () => {
        const [result] = await smokeTestManifest([fixture('slot-element.ts')]);
        assert.strictEqual(result!.slots, undefined);
    });
});

describe('formatSmokeResults with advisory warnings', () => {
    it('prints warning lines and a warning count', async () => {
        const results = await smokeTestManifest([fixture('reflect-element.ts'), fixture('slot-element.ts')], {
            reflection: true,
            slots: true,
        });
        const report = formatSmokeResults(results);
        assert.match(report, /PASS <reflect-element>/);
        assert.match(report, /warn reflection \[reflect-element\] .*oneway/);
        assert.match(report, /warn slot \[slot-element\] .*missing/);
        assert.match(report, /\d+\/2 passed, \d+ warnings/);
    });
});
