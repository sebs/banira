import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
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

    it('lowers CSS imports to an adopted constructable stylesheet (issue #52)', async () => {
        const ctx = await new TestHelper().compileAndMountAsScript('styled-box', './test/fixtures/css/styled-box.ts');
        const el = ctx.document.querySelector('styled-box')!;
        assert.ok(ctx.window.customElements.get('styled-box'), 'element should be defined');
        const [sheet] = el.shadowRoot!.adoptedStyleSheets;
        assert.match(sheet!.cssRules[0]!.cssText, /\.box/);
        ctx.jsdom.window.close();
    });

    it('lowers HTML imports to a cloned <template> (issue #52)', async () => {
        const ctx = await new TestHelper().compileAndMountAsScript('templated-card', './test/fixtures/html/templated-card.ts');
        assert.ok(ctx.query('slot[name="title"]'), 'template content should be cloned into the shadow root');
        assert.match(ctx.query('p')!.textContent!, /"Body" &/);
        ctx.jsdom.window.close();
    });

    it('confineToRoot also refuses inlining a stylesheet from outside the root', () => {
        const dir = mkdtempSync(join(tmpdir(), 'banira-confine-css-'));
        try {
            mkdirSync(join(dir, 'root'));
            writeFileSync(join(dir, 'secret.css'), '.secret{}', 'utf8');
            writeFileSync(
                join(dir, 'root', 'leaky-el.ts'),
                "import s from '../secret.css';\ncustomElements.define('leaky-el', class extends HTMLElement { x = s; });\n",
                'utf8'
            );
            assert.throws(
                () => bundleModule(join(dir, 'root', 'leaky-el.ts'), {}, { confineToRoot: join(dir, 'root') }),
                /refusing to bundle .*secret\.css/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
