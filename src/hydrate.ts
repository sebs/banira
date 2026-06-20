export interface HydrateOptions {
    /** Mode used when *creating* a shadow root (only when the host wasn't prerendered). Default `'open'`. */
    mode?: 'open' | 'closed';
    /** Markup to render into the shadow root when the host was **not** prerendered (root is empty). */
    template?: string;
    /**
     * Constructable stylesheet(s) to adopt. Applied whether the tree was
     * prerendered or freshly rendered — Declarative Shadow DOM markup ships
     * without the constructable sheet (it isn't serialized), so the shared sheet
     * (see banira's CSS lowering) styles the adopted tree on hydration.
     */
    styles?: CSSStyleSheet | CSSStyleSheet[];
}

export interface HydrateResult {
    /** The shadow root — the adopted prerendered one, or a freshly created one. */
    shadow: ShadowRoot;
    /** True when an existing (prerendered, non-empty) shadow root was adopted instead of rendered. */
    hydrated: boolean;
}

/**
 * The client half of banira's Declarative Shadow DOM prerender (see
 * `createPrerenderer`/`banira prerender`). Call it from a custom element's
 * constructor or `connectedCallback`:
 *
 * - If the parser already attached a **non-empty** shadow root (from DSD), it is
 *   *adopted as-is* — no re-render, so the prerendered markup never flashes.
 * - Otherwise a shadow root is created and `template` is rendered into it.
 *
 * In both cases any `styles` are adopted, since constructable stylesheets are
 * not part of the serialized DSD markup. Returns the shadow root and whether it
 * was hydrated, so callers can skip re-binding already-bound prerendered nodes.
 *
 * ```ts
 * connectedCallback() {
 *   const { shadow, hydrated } = hydrateShadow(this, { template: TEMPLATE, styles: sheet });
 *   if (!hydrated) this.wireUpFreshDom(shadow);
 * }
 * ```
 */
export function hydrateShadow(host: HTMLElement, options: HydrateOptions = {}): HydrateResult {
    const existing = host.shadowRoot;
    const hydrated = Boolean(existing && existing.childNodes.length > 0);
    const shadow = existing ?? host.attachShadow({ mode: options.mode ?? 'open' });

    if (!hydrated && options.template != null) shadow.innerHTML = options.template;
    if (options.styles) {
        shadow.adoptedStyleSheets = Array.isArray(options.styles) ? options.styles : [options.styles];
    }
    return { shadow, hydrated };
}
