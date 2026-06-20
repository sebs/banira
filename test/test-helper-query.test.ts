import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TestHelper } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const circle = resolve(__dirname, '../examples/my-circle/my-circle.ts');

describe('mount context shadow-piercing query (issue #35)', () => {
    it('query/queryAll select across the shadow boundary', async () => {
        const ctx = await new TestHelper().compileAndMountAsScript('my-circle', circle, undefined, { size: '20' });
        try {
            // <circle> lives inside my-circle's shadow root — plain querySelector can't reach it.
            assert.strictEqual(ctx.document.querySelector('circle'), null);
            assert.ok(ctx.query('circle'), 'shadow-piercing query should find the shadow <circle>');
            assert.strictEqual(ctx.queryAll('circle').length, 1);
            assert.strictEqual(ctx.query('.does-not-exist'), null);
        } finally {
            ctx.jsdom.window.close();
        }
    });
});
