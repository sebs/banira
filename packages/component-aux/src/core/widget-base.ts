/**
 * WidgetBase — common base for all AUX-style custom elements.
 *
 * Provides the two things every widget needs and which the original AUX `Widget`
 * supplied through its render engine:
 *
 * 1. **Coalesced rendering.** `requestUpdate()` batches multiple synchronous
 *    option writes into a single `render()` per microtask, so setting `min`,
 *    `max` and `value` in a row repaints once — not three times. High-frequency
 *    widgets (meters) therefore avoid per-set layout thrash. The first render
 *    after connection happens synchronously so the element is never briefly
 *    empty.
 * 2. **Event sugar.** `emit()` dispatches a `CustomEvent`; value widgets use the
 *    DOM-idiomatic `input` (live drag) and `change` (committed) events that map
 *    onto AUX's `userset`/`useraction`.
 */
export abstract class WidgetBase extends HTMLElement {
    /** The shadow root, created on first connect. */
    protected root!: ShadowRoot;
    private _dirty = false;
    private _ready = false;

    /** Subclasses paint into `this.root` here. Called after options change. */
    protected abstract render(): void;

    connectedCallback(): void {
        if (!this.root) {
            this.root = this.attachShadow({ mode: 'open' });
        }
        this._ready = true;
        this.render();
    }

    /**
     * Schedules a coalesced render. Multiple calls within the same microtask
     * collapse into one `render()`. No-op until the element is connected.
     */
    protected requestUpdate(): void {
        if (this._dirty || !this._ready) return;
        this._dirty = true;
        queueMicrotask(() => {
            this._dirty = false;
            if (this._ready) this.render();
        });
    }

    /** Dispatches a bubbling, composed `CustomEvent`. */
    protected emit<T>(type: string, detail?: T): boolean {
        return this.dispatchEvent(
            new CustomEvent<T>(type, { detail, bubbles: true, composed: true })
        );
    }

    /** Reads a numeric attribute, falling back to `fallback` when absent/NaN. */
    protected numAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name);
        if (raw === null) return fallback;
        const n = parseFloat(raw);
        return Number.isNaN(n) ? fallback : n;
    }

    /** Reads a boolean attribute (presence-based, or explicit "false"). */
    protected boolAttr(name: string): boolean {
        const raw = this.getAttribute(name);
        return raw !== null && raw !== 'false';
    }
}
