/**
 * Client-side HMR runtime for custom elements (#8).
 *
 * The custom-element registry is immutable per tag name — you cannot redefine a
 * tag. The trick this runtime uses: per spec, the UA captures an element's
 * lifecycle callbacks (`connectedCallback` etc.) and `observedAttributes` from
 * the class **at definition time**. So we register a stable *shell* class once,
 * and that shell delegates each lifecycle reaction to the *current*
 * implementation. On a hot update the module re-runs `customElements.define`,
 * which we intercept to (a) record the new implementation and (b) re-point every
 * live instance's prototype at it and re-run its lifecycle — no full reload.
 *
 * Known limitations (documented; full reload is always the fallback):
 * - `observedAttributes` is fixed at the first definition (the UA reads it once).
 * - The constructor runs once (the first implementation's), so shadow-root setup
 *   persists across swaps; new implementations should (re)populate it in
 *   `connectedCallback`/`render`, which is the common pattern anyway.
 *
 * `installHmr` is written to be both callable directly (jsdom tests) and
 * serializable via `Function.prototype.toString()` for browser injection — so it
 * must not reference any module-scope binding.
 */
export function installHmr(win: {
    customElements: CustomElementRegistry & { __baniraHmr?: unknown };
}): { swap: (tag: string, ctor: CustomElementConstructor) => void } {
    const ce = win.customElements;
    if (ce.__baniraHmr) return ce.__baniraHmr as { swap: (tag: string, ctor: CustomElementConstructor) => void };

    const nativeDefine = ce.define.bind(ce);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const impls = new Map<string, any>();
    const live = new Map<string, Set<HTMLElement>>();

    const liveSet = (tag: string): Set<HTMLElement> => {
        let set = live.get(tag);
        if (!set) live.set(tag, (set = new Set()));
        return set;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (tag: string, el: HTMLElement, method: string, args: any[]): void => {
        const impl = impls.get(tag);
        const fn = impl && impl.prototype[method];
        if (typeof fn === 'function') fn.apply(el, args);
    };

    const swap = (tag: string, ctor: CustomElementConstructor): void => {
        impls.set(tag, ctor);
        for (const el of liveSet(tag)) {
            // Re-point the instance at the new implementation so its own methods
            // (render, getters…) resolve to the new code, then re-run connect.
            Object.setPrototypeOf(el, ctor.prototype);
            if (el.isConnected) delegate(tag, el, 'connectedCallback', []);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ce as any).define = function (tag: string, ctor: CustomElementConstructor, options?: ElementDefinitionOptions): void {
        if (impls.has(tag)) {
            swap(tag, ctor);
            return;
        }
        impls.set(tag, ctor);
        liveSet(tag);

        // The shell extends the first implementation so its constructor (shadow
        // root setup) runs on construction; lifecycle reactions delegate to the
        // current implementation captured in `impls`.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shell = class extends (ctor as any) {
            connectedCallback(): void {
                liveSet(tag).add(this as unknown as HTMLElement);
                delegate(tag, this as unknown as HTMLElement, 'connectedCallback', []);
            }
            disconnectedCallback(): void {
                liveSet(tag).delete(this as unknown as HTMLElement);
                delegate(tag, this as unknown as HTMLElement, 'disconnectedCallback', []);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            attributeChangedCallback(...args: any[]): void {
                delegate(tag, this as unknown as HTMLElement, 'attributeChangedCallback', args);
            }
            adoptedCallback(): void {
                delegate(tag, this as unknown as HTMLElement, 'adoptedCallback', []);
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const observed = (ctor as any).observedAttributes;
        if (observed) Object.defineProperty(shell, 'observedAttributes', { get: () => observed });

        nativeDefine(tag, shell as unknown as CustomElementConstructor, options);
    };

    const api = { swap };
    Object.defineProperty(ce, '__baniraHmr', { value: api });
    return api;
}

/** EventSource snippet (browser) that applies `hmr:<url>` updates and falls back to reload. */
const HMR_SSE = `
new EventSource('/__livereload').onmessage = (e) => {
  const data = String(e.data || '');
  if (data.indexOf('hmr:') === 0) {
    const url = data.slice(4);
    import(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now()).catch(() => location.reload());
  } else {
    location.reload();
  }
};
`;

/**
 * The full HMR client script injected into served pages: installs the
 * custom-element HMR runtime, then wires the EventSource that drives updates.
 */
export const HMR_CLIENT_SCRIPT = `(${installHmr.toString()})(window);\n${HMR_SSE}`;

/** Builds the `hmr:<url>` SSE payload the server pushes for a changed module. */
export function hmrMessage(moduleUrl: string): string {
    return `hmr:${moduleUrl}`;
}
