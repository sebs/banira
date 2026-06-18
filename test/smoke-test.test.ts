import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { smokeTestManifest, formatSmokeResults } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const circle = resolve(__dirname, '../examples/my-circle/my-circle.ts');

describe('smokeTestManifest (Tier 4)', () => {
    it('passes a component that registers and upgrades', async () => {
        const results = await smokeTestManifest([circle]);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0]!.tagName, 'my-circle');
        assert.strictEqual(results[0]!.ok, true, results[0]!.error);
    });

    it('formats a passing report', async () => {
        const results = await smokeTestManifest([circle]);
        const report = formatSmokeResults(results);
        assert.match(report, /PASS <my-circle>/);
        assert.match(report, /1\/1 passed/);
    });
});
