/**
 * A generic container with show/hide.
 *
 * Clean-room reimplementation of AUX's `Container` (original code, MIT). Where
 * AUX maintained a widget tree, this port projects light-DOM children through a
 * `<slot>` — the web-component-native equivalent. Visibility toggles the
 * `hidden` attribute.
 *
 * @demo
 * ```html
 * <aux-container><p>content</p></aux-container>
 * ```
 *
 * @remarks
 * Attributes: `hidden`. Methods: `show()`, `hide()`, `toggle()`. Emits
 * `show`/`hide`.
 */
import { WidgetBase } from '../core/widget-base.js';

export class AuxContainer extends WidgetBase {
    get visible(): boolean {
        return !this.hasAttribute('hidden');
    }
    set visible(v: boolean) {
        if (v) this.show();
        else this.hide();
    }

    show(): void {
        if (this.visible) return;
        this.removeAttribute('hidden');
        this.emit('show');
    }

    hide(): void {
        if (!this.visible) return;
        this.setAttribute('hidden', '');
        this.emit('hide');
    }

    toggle(): void {
        if (this.visible) this.hide();
        else this.show();
    }

    protected render(): void {
        this.root.innerHTML = `
            <style>
                :host { display: block; }
                :host([hidden]) { display: none; }
                .container { display: block; }
            </style>
            <div class="container" part="container"><slot></slot></div>
        `;
    }
}

if (!customElements.get('aux-container')) {
    customElements.define('aux-container', AuxContainer);
}
