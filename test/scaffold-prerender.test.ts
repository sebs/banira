import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import {
    smokeTestManifest,
    scaffoldComponent,
    scaffoldTheme,
    parseDesignTokens,
    prerenderManifest,
    createPrerenderer,
    declarativeShadowDom,
    ManifestGenerator,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const circle = resolve(__dirname, '../examples/my-circle/my-circle.ts');

describe('scaffoldComponent (Tier 5)', () => {
    it('generates a component source and a demo page', () => {
        const files = scaffoldComponent('my-widget');
        const paths = files.map((f) => f.path).sort();
        assert.deepStrictEqual(paths, ['index.html', 'my-widget.ts']);
        const component = files.find((f) => f.path === 'my-widget.ts')!.content;
        assert.match(component, /class MyWidget extends HTMLElement/);
        assert.match(component, /customElements\.define\('my-widget', MyWidget\)/);
        assert.match(component, /@fires my-widget-change/);
        const demo = files.find((f) => f.path === 'index.html')!.content;
        assert.match(demo, /<my-widget /);
        assert.match(demo, /\.\/dist\/my-widget\.js/);
    });

    it('rejects an invalid tag name', () => {
        assert.throws(() => scaffoldComponent('NoHyphen'), /not a valid custom element name/);
    });

    it('scaffolds a component that passes its own smoke test', async () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-scaffold-'));
        for (const file of scaffoldComponent('round-trip')) {
            writeFileSync(resolve(dir, file.path), file.content, 'utf8');
        }
        const results = await smokeTestManifest([resolve(dir, 'round-trip.ts')]);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0]!.ok, true, results[0]!.error);
    });

    it('scaffolds a form-associated element with ElementInternals wiring (issue #12)', () => {
        const files = scaffoldComponent('fancy-input', { formAssociated: true });
        const component = files.find((f) => f.path === 'fancy-input.ts')!.content;
        assert.match(component, /static formAssociated = true/);
        assert.match(component, /this\.attachInternals\(\)/);
        assert.match(component, /setFormValue\(/);
        assert.match(component, /formResetCallback\(/);
        assert.match(component, /setValidity\(/);
        // documents the Firefox ARIA/role caveat
        assert.match(component, /Firefox/);
        // demo wraps the element in a <form>
        const demo = files.find((f) => f.path === 'index.html')!.content;
        assert.match(demo, /<form>/);
        assert.match(demo, /<fancy-input /);
    });

    it('form-associated scaffold passes its own smoke test', async () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-scaffold-fa-'));
        for (const file of scaffoldComponent('fa-widget', { formAssociated: true })) {
            writeFileSync(resolve(dir, file.path), file.content, 'utf8');
        }
        const results = await smokeTestManifest([resolve(dir, 'fa-widget.ts')]);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0]!.ok, true, results[0]!.error);
    });

    it('scaffolds an ARIA-reflecting element via ElementInternals (issue #51)', () => {
        const files = scaffoldComponent('toggle-switch', { aria: true });
        const component = files.find((f) => f.path === 'toggle-switch.ts')!.content;
        assert.match(component, /this\.attachInternals\(\)/);
        assert.match(component, /this\.internals\.role = 'checkbox'/);
        assert.match(component, /this\.internals\.ariaChecked = String/);
        assert.match(component, /this\.internals\.ariaDisabled = String/);
        // keyboard activation + focusability so it behaves like a native control
        assert.match(component, /keydown/);
        assert.match(component, /this\.tabIndex = 0/);
        // records the default role for the manifest, and documents the Firefox caveat
        assert.match(component, /@role checkbox/);
        assert.match(component, /Firefox/);
        const demo = files.find((f) => f.path === 'index.html')!.content;
        assert.match(demo, /<toggle-switch/);
    });

    it('ARIA scaffold passes its own smoke test', async () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-scaffold-aria-'));
        for (const file of scaffoldComponent('aria-widget', { aria: true })) {
            writeFileSync(resolve(dir, file.path), file.content, 'utf8');
        }
        const results = await smokeTestManifest([resolve(dir, 'aria-widget.ts')]);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0]!.ok, true, results[0]!.error);
    });

    it('records the @role tag from the ARIA scaffold in the manifest', () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-scaffold-role-'));
        const file = scaffoldComponent('role-widget', { aria: true }).find((f) => f.path === 'role-widget.ts')!;
        writeFileSync(resolve(dir, file.path), file.content, 'utf8');
        const pkg = new ManifestGenerator([resolve(dir, 'role-widget.ts')]).generate();
        const decl = pkg.modules[0]!.declarations[0]!;
        assert.strictEqual((decl as { role?: string }).role, 'checkbox');
    });
});

describe('scaffoldTheme (issue #50)', () => {
    it('generates a theme contract, a toggle component, and a demo', () => {
        const files = scaffoldTheme();
        assert.deepStrictEqual(files.map((f) => f.path).sort(), ['index.html', 'theme-toggle.ts', 'theme.css']);

        const css = files.find((f) => f.path === 'theme.css')!.content;
        assert.match(css, /:root \{/);
        assert.match(css, /\[data-theme="dark"\] \{/);
        assert.match(css, /@media \(prefers-color-scheme: dark\)/);
        // explicit light choice wins over the OS preference
        assert.match(css, /:root:not\(\[data-theme="light"\]\)/);

        const component = files.find((f) => f.path === 'theme-toggle.ts')!.content;
        assert.match(component, /class ThemeToggle extends HTMLElement/);
        assert.match(component, /document\.documentElement\.setAttribute\('data-theme'/);
        assert.match(component, /localStorage/);
        assert.match(component, /prefers-color-scheme: dark/);

        const demo = files.find((f) => f.path === 'index.html')!.content;
        assert.match(demo, /<theme-toggle/);
        assert.match(demo, /href="\.\/theme\.css"/);
    });

    it('honors a custom tag name', () => {
        const files = scaffoldTheme({ tagName: 'color-scheme-switch' });
        assert.ok(files.some((f) => f.path === 'color-scheme-switch.ts'));
        assert.match(files.find((f) => f.path === 'index.html')!.content, /<color-scheme-switch/);
    });

    it('rejects an invalid tag name', () => {
        assert.throws(() => scaffoldTheme({ tagName: 'NoHyphen' }), /not a valid custom element name/);
    });

    it('seeds the :root token set from a DTCG document', () => {
        const tokens = parseDesignTokens({ color: { $type: 'color', bg: { $value: '#ffffff' } } });
        const css = scaffoldTheme({ tokens }).find((f) => f.path === 'theme.css')!.content;
        assert.match(css, /--color-bg: #ffffff;/);
    });

    it('the toggle component passes its own smoke test', async () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-theme-'));
        for (const file of scaffoldTheme()) {
            writeFileSync(resolve(dir, file.path), file.content, 'utf8');
        }
        const results = await smokeTestManifest([resolve(dir, 'theme-toggle.ts')]);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0]!.ok, true, results[0]!.error);
    });
});

describe('scaffoldComponent hydrate variant (issue #32)', () => {
    it('generates an adopt-or-render component that adopts an existing shadow root', () => {
        const component = scaffoldComponent('hy-card', { hydrate: true }).find((f) => f.path === 'hy-card.ts')!.content;
        // adopt the prerendered root if present, else create one
        assert.match(component, /if \(!this\.shadowRoot\) this\.attachShadow\(\{ mode: 'open' \}\)/);
        // skip the initial render when the shadow root is already populated (prerendered)
        assert.match(component, /const prerendered = shadow\.firstChild !== null;/);
        assert.match(component, /if \(!prerendered\) this\.render\(\);/);
        // the constructable stylesheet is adopted on hydration
        assert.match(component, /shadow\.adoptedStyleSheets = \[sheet\];/);
    });

    it('hydrate scaffold passes its own smoke test (client-only mount renders)', async () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-hydrate-'));
        for (const file of scaffoldComponent('hy-widget', { hydrate: true })) {
            writeFileSync(resolve(dir, file.path), file.content, 'utf8');
        }
        const results = await smokeTestManifest([resolve(dir, 'hy-widget.ts')]);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0]!.ok, true, results[0]!.error);
    });

    it('prerenders to DSD that the component can later adopt', async () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-hydrate-'));
        for (const file of scaffoldComponent('hy-box', { hydrate: true })) {
            writeFileSync(resolve(dir, file.path), file.content, 'utf8');
        }
        const renderer = await createPrerenderer([resolve(dir, 'hy-box.ts')]);
        const html = await renderer.renderToString('hy-box', { attributes: { value: 'Hi' } });
        renderer.close();
        assert.match(html, /<hy-box value="Hi"><template shadowrootmode="open">/);
        assert.match(html, /<span part="label">Hi<\/span>/);
    });
});

describe('prerenderManifest (Tier 5)', () => {
    it('wraps shadow DOM in a declarative shadow root template', async () => {
        const results = await prerenderManifest([circle], { attributes: { size: '40' } });
        assert.strictEqual(results.length, 1);
        const html = results[0]!.html;
        assert.match(html, /<my-circle size="40">/);
        assert.match(html, /<template shadowrootmode="open">/);
        assert.match(html, /<svg/);
    });

    it('declarativeShadowDom composes the template markup', () => {
        const html = declarativeShadowDom('x-y', '<p>hi</p>', { a: 'b' });
        assert.strictEqual(html, '<x-y a="b"><template shadowrootmode="open"><p>hi</p></template></x-y>');
    });
});
