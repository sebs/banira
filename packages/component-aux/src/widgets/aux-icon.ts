/**
 * A small icon element.
 *
 * Clean-room reimplementation of AUX's `Icon` (original code, MIT). The `icon`
 * value renders as either a CSS class, a CSS custom property
 * (`background-image: var(--name)`), or a file path (`url(...)`).
 *
 * @demo
 * ```html
 * <aux-icon icon="play"></aux-icon>
 * ```
 *
 * @remarks
 * Attributes: `icon`.
 */
import { WidgetBase } from '../core/widget-base.js';

export class AuxIcon extends WidgetBase {
    static get observedAttributes(): string[] {
        return ['icon'];
    }

    get icon(): string {
        return this.getAttribute('icon') ?? '';
    }
    set icon(v: string) {
        this.setAttribute('icon', v);
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
        super.connectedCallback();
    }

    attributeChangedCallback(): void {
        this.requestUpdate();
    }

    protected render(): void {
        const icon = this.icon;
        let background = '';
        let cls = '';
        if (icon.startsWith('--')) {
            background = `background-image: var(${icon});`;
        } else if (/[./]/.test(icon)) {
            background = `background-image: url("${icon.replace(/"/g, '%22')}");`;
        } else if (icon) {
            cls = icon;
        }

        this.root.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    width: var(--aux-icon-size, 1em);
                    height: var(--aux-icon-size, 1em);
                }
                .icon { width: 100%; height: 100%; background-size: contain; background-repeat: no-repeat; background-position: center; }
            </style>
            <span class="icon ${cls}" part="icon" style="${background}"></span>
        `;
    }
}

if (!customElements.get('aux-icon')) {
    customElements.define('aux-icon', AuxIcon);
}
