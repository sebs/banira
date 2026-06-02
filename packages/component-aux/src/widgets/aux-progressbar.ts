/**
 * A horizontal/vertical progress bar.
 *
 * Clean-room reimplementation of AUX's `ProgressBar` (original code, MIT). A
 * read-only level bar with an optional value readout.
 *
 * @demo
 * ```html
 * <aux-progressbar value="42" min="0" max="100"></aux-progressbar>
 * ```
 *
 * @remarks
 * Attributes: `value`, `min`, `max`, `layout` (top/left/right/bottom),
 * `show-value`.
 */
import { WidgetBase } from '../core/widget-base.js';
import { Range } from '../core/range.js';

export class AuxProgressBar extends WidgetBase {
    private range = new Range({ min: 0, max: 100 });
    private _value = 0;

    /** Formats the numeric value for the readout. */
    formatValue: (v: number) => string = (v) => `${v.toFixed(0)}%`;

    static get observedAttributes(): string[] {
        return ['value', 'min', 'max', 'layout', 'show-value'];
    }

    get value(): number {
        return this._value;
    }
    set value(v: number) {
        this._value = this.range.clamp(v);
        this.setAttribute('aria-valuenow', String(this._value));
        this.requestUpdate();
    }

    get min(): number {
        return this.range.options.min;
    }
    set min(v: number) {
        this.range.set('min', v);
        this.setAttribute('aria-valuemin', String(v));
        this.value = this._value;
    }

    get max(): number {
        return this.range.options.max;
    }
    set max(v: number) {
        this.range.set('max', v);
        this.setAttribute('aria-valuemax', String(v));
        this.value = this._value;
    }

    private get vertical(): boolean {
        const l = this.getAttribute('layout');
        return l === 'left' || l === 'right';
    }

    connectedCallback(): void {
        this.range.set('min', this.numAttr('min', 0));
        this.range.set('max', this.numAttr('max', 100));
        this._value = this.range.clamp(this.numAttr('value', 0));
        if (!this.hasAttribute('role')) this.setAttribute('role', 'progressbar');
        this.setAttribute('aria-valuemin', String(this.range.options.min));
        this.setAttribute('aria-valuemax', String(this.range.options.max));
        this.setAttribute('aria-valuenow', String(this._value));
        super.connectedCallback();
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
        if (value === null && name !== 'show-value') return;
        switch (name) {
            case 'value': this.value = parseFloat(value ?? '0'); break;
            case 'min': this.min = parseFloat(value ?? '0'); break;
            case 'max': this.max = parseFloat(value ?? '100'); break;
            default: this.requestUpdate();
        }
    }

    protected render(): void {
        const coef = this.range.valueToCoef(this._value);
        const vertical = this.vertical;
        const showValue = this.getAttribute('show-value') !== 'false';
        const fill = vertical
            ? `left: 0; right: 0; bottom: 0; height: ${coef * 100}%;`
            : `top: 0; bottom: 0; left: 0; width: ${coef * 100}%;`;

        this.root.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    width: var(--aux-progressbar-width, ${vertical ? '24px' : '200px'});
                    height: var(--aux-progressbar-height, ${vertical ? '160px' : '20px'});
                }
                .track {
                    position: relative; width: 100%; height: 100%;
                    background: var(--aux-track, #333); border-radius: 4px; overflow: hidden;
                }
                .fill { position: absolute; background: var(--aux-accent, #3b82f6); }
                .value {
                    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
                    font: var(--aux-font, 12px sans-serif); color: var(--aux-fg, #fff);
                }
            </style>
            <div class="track" part="track">
                <div class="fill" part="value" style="${fill}"></div>
                ${showValue ? `<div class="value" part="label">${escapeText(this.formatValue(this._value))}</div>` : ''}
            </div>
        `;
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!customElements.get('aux-progressbar')) {
    customElements.define('aux-progressbar', AuxProgressBar);
}
