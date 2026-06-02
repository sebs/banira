/**
 * A text label widget.
 *
 * Clean-room reimplementation of AUX's `Label` (original code, MIT).
 *
 * @demo
 * ```html
 * <aux-label label="Gain"></aux-label>
 * ```
 *
 * @remarks
 * Attributes: `label`. The displayed text can also be set via the `label`
 * property; an optional `format` function transforms it.
 */
import { WidgetBase } from '../core/widget-base.js';

export class AuxLabel extends WidgetBase {
    static get observedAttributes(): string[] {
        return ['label'];
    }

    /** Optional transform applied to the label before display. */
    format: ((label: string) => string) | null = null;

    get label(): string {
        return this.getAttribute('label') ?? '';
    }
    set label(v: string) {
        this.setAttribute('label', v);
    }

    attributeChangedCallback(): void {
        this.requestUpdate();
    }

    protected render(): void {
        const text = this.format ? this.format(this.label) : this.label;
        this.root.innerHTML = `
            <style>
                :host { display: inline-block; font: var(--aux-font, inherit); color: var(--aux-fg, inherit); }
            </style>
            <span part="label">${escapeText(text)}</span>
        `;
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!customElements.get('aux-label')) {
    customElements.define('aux-label', AuxLabel);
}
