import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestHelper, bundleModule } from '../src/index.js';

const MULTI = './test/fixtures/multi/greet-element.ts';

describe('TestHelper multi-module mounting', () => {
    it('mounts a component that imports sibling modules (transitively)', async () => {
        // greet-element -> greet-helper -> punctuation
        const helper = new TestHelper();
        const ctx = await helper.compileAndMountAsScript('greet-element', MULTI);
        assert.ok(ctx.window.customElements.get('greet-element'), 'element should be defined');
        const el = ctx.document.querySelector('greet-element');
        assert.strictEqual(el?.textContent, 'Hello, world!', 'imported helpers should run');
    });

    it('still mounts a single-file component with no imports', async () => {
        const helper = new TestHelper();
        const ctx = await helper.compileAndMountAsScript('my-circle', './test/fixtures/my-circle.ts');
        assert.ok(ctx.window.customElements.get('my-circle'), 'single-file element should be defined');
        assert.ok(ctx.document.querySelector('my-circle')?.shadowRoot, 'should render its shadow root');
    });

    it('bundleModule inlines the whole graph and emits no import/export statements', () => {
        const code = bundleModule(MULTI);
        assert.doesNotMatch(code, /^\s*import\s/m, 'no ESM import statements');
        assert.doesNotMatch(code, /^\s*export\s/m, 'no ESM export statements');
        // all three modules should be present in the registry
        for (const name of ['greet-element.js', 'greet-helper.js', 'punctuation.js']) {
            assert.ok(code.includes(name), `bundle should contain ${name}`);
        }
    });
});
