/**
 * A multi-page container that shows one child at a time.
 *
 * Clean-room reimplementation of AUX's `Pages` (original code, MIT). Each direct
 * child is a page; the `show` index selects the visible one (others get the
 * `hidden` attribute).
 *
 * @demo
 * ```html
 * <aux-pages show="0"><div>One</div><div>Two</div></aux-pages>
 * ```
 *
 * @remarks
 * Attributes: `show` (page index). Method `showPage(i)`; emits `changed`.
 */
import { WidgetBase } from '../core/widget-base.js';

export class AuxPages extends WidgetBase {
    static get observedAttributes(): string[] {
        return ['show'];
    }

    /** The pages (direct element children). */
    protected get pages(): HTMLElement[] {
        return Array.from(this.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
    }

    get show(): number {
        return this.numAttr('show', 0);
    }
    set show(i: number) {
        this.setAttribute('show', String(i));
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.updatePages();
    }

    attributeChangedCallback(): void {
        this.updatePages();
        this.requestUpdate();
    }

    /** Selects a page by index and notifies listeners. */
    showPage(index: number): void {
        if (index === this.show) return;
        this.show = index;
        this.emit('changed', { index });
    }

    protected updatePages(): void {
        const active = this.show;
        this.pages.forEach((page, i) => {
            page.hidden = i !== active;
        });
    }

    protected render(): void {
        this.root.innerHTML = `
            <style>:host { display: block; }</style>
            <slot></slot>
        `;
    }
}

if (!customElements.get('aux-pages')) {
    customElements.define('aux-pages', AuxPages);
}
