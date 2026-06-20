import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { hydrateShadow } from '../src/index.js';

describe('hydrateShadow (issue #32)', () => {
    let window: JSDOM['window'];
    before(() => {
        window = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' }).window;
    });

    const el = () => window.document.createElement('div') as unknown as HTMLElement;

    it('adopts a prerendered (non-empty) shadow root without re-rendering', () => {
        const host = el();
        const sr = (host as unknown as { attachShadow: (i: { mode: string }) => ShadowRoot }).attachShadow({ mode: 'open' });
        sr.innerHTML = '<span part="label">Prerendered</span>';

        const { shadow, hydrated } = hydrateShadow(host, { template: '<span>fresh</span>' });
        assert.strictEqual(hydrated, true);
        assert.strictEqual(shadow.innerHTML, '<span part="label">Prerendered</span>'); // template ignored
    });

    it('creates a shadow root and renders the template when not prerendered', () => {
        const host = el();
        const { shadow, hydrated } = hydrateShadow(host, { template: '<span>fresh</span>' });
        assert.strictEqual(hydrated, false);
        assert.strictEqual(shadow.innerHTML, '<span>fresh</span>');
    });

    it('adopts constructable stylesheets whether prerendered or freshly rendered', () => {
        const sheet = new window.CSSStyleSheet();
        sheet.replaceSync(':host{color:red}');

        const fresh = el();
        hydrateShadow(fresh, { template: '<i></i>', styles: sheet });
        assert.deepStrictEqual(fresh.shadowRoot!.adoptedStyleSheets, [sheet]);

        const pre = el();
        const sr = (pre as unknown as { attachShadow: (i: { mode: string }) => ShadowRoot }).attachShadow({ mode: 'open' });
        sr.innerHTML = '<i>x</i>';
        hydrateShadow(pre, { styles: [sheet] });
        assert.deepStrictEqual(pre.shadowRoot!.adoptedStyleSheets, [sheet]);
    });

    it('drops the prerendered critical <style> once the constructable sheet is adopted (issue #44)', () => {
        const sheet = new window.CSSStyleSheet();
        sheet.replaceSync(':host{color:red}');
        const host = el();
        const sr = (host as unknown as { attachShadow: (i: { mode: string }) => ShadowRoot }).attachShadow({ mode: 'open' });
        // Simulate prerendered DSD: critical style + content.
        sr.innerHTML = '<style data-banira-critical>:host{color:red}</style><span part="label">Hi</span>';

        const { hydrated } = hydrateShadow(host, { styles: sheet });
        assert.strictEqual(hydrated, true);
        assert.strictEqual(host.shadowRoot!.querySelector('style[data-banira-critical]'), null);
        assert.deepStrictEqual(host.shadowRoot!.adoptedStyleSheets, [sheet]);
        assert.ok(host.shadowRoot!.querySelector('[part="label"]'), 'prerendered content is preserved');
    });
});
