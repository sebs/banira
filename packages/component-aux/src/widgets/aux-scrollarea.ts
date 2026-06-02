/**
 * A scrollable container.
 *
 * Clean-room reimplementation of AUX's `ScrollArea` (original code, MIT).
 * Children are projected through a `<slot>` inside a native overflow scroller.
 *
 * @demo
 * ```html
 * <aux-scrollarea style="height:120px"><p>long content…</p></aux-scrollarea>
 * ```
 *
 * @remarks
 * Attributes: `direction` (vertical/horizontal/both, default vertical).
 */
import { WidgetBase } from '../core/widget-base.js';

export class AuxScrollArea extends WidgetBase {
    static get observedAttributes(): string[] {
        return ['direction'];
    }

    attributeChangedCallback(): void {
        this.requestUpdate();
    }

    protected render(): void {
        const dir = this.getAttribute('direction') ?? 'vertical';
        const overflow =
            dir === 'horizontal' ? 'overflow-x: auto; overflow-y: hidden;'
            : dir === 'both' ? 'overflow: auto;'
            : 'overflow-y: auto; overflow-x: hidden;';
        this.root.innerHTML = `
            <style>
                :host { display: block; }
                .scroller { width: 100%; height: 100%; ${overflow} }
            </style>
            <div class="scroller" part="scroller"><slot></slot></div>
        `;
    }
}

if (!customElements.get('aux-scrollarea')) {
    customElements.define('aux-scrollarea', AuxScrollArea);
}
