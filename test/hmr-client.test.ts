import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { installHmr, HMR_CLIENT_SCRIPT, hmrMessage } from '../src/index.js';

describe('HMR runtime (issue #8)', () => {
    it('hot-swaps a custom element implementation in place without redefining', () => {
        const dom = new JSDOM('<!DOCTYPE html><body><x-widget></x-widget></body>', { url: 'http://localhost' });
        const win = dom.window as unknown as { customElements: CustomElementRegistry; HTMLElement: typeof HTMLElement; document: Document };
        installHmr(win as never);

        // v1: renders "one"
        class V1 extends win.HTMLElement {
            connectedCallback(): void {
                this.textContent = this.render();
            }
            render(): string {
                return 'one';
            }
        }
        win.customElements.define('x-widget', V1 as unknown as CustomElementConstructor);

        const el = win.document.querySelector('x-widget')!;
        assert.strictEqual(el.textContent, 'one', 'v1 should render');

        // v2: same tag, new implementation — define() again triggers a hot swap.
        class V2 extends win.HTMLElement {
            connectedCallback(): void {
                this.textContent = this.render();
            }
            render(): string {
                return 'two';
            }
        }
        win.customElements.define('x-widget', V2 as unknown as CustomElementConstructor);

        assert.strictEqual(el.textContent, 'two', 'existing instance should pick up v2 without a reload');
        // The element was never re-created; it is the same node.
        assert.strictEqual(el, win.document.querySelector('x-widget'));
    });

    it('is idempotent — installing twice returns the same runtime', () => {
        const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost' });
        const win = dom.window as unknown as { customElements: CustomElementRegistry };
        const a = installHmr(win as never);
        const b = installHmr(win as never);
        assert.strictEqual(a, b);
    });

    it('builds the hmr SSE payload', () => {
        assert.strictEqual(hmrMessage('/dist/my-el.js'), 'hmr:/dist/my-el.js');
    });

    it('the injected client script installs the runtime and wires EventSource', () => {
        assert.match(HMR_CLIENT_SCRIPT, /installHmr|__baniraHmr/);
        assert.match(HMR_CLIENT_SCRIPT, /EventSource\('\/__livereload'\)/);
        assert.match(HMR_CLIENT_SCRIPT, /hmr:/);
        assert.match(HMR_CLIENT_SCRIPT, /location\.reload/);
    });
});
