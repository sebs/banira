/**
 * A level meter — a filled bar from `base` to `value`.
 *
 * Clean-room reimplementation of AUX's `Meter` (original code, MIT). The AUX
 * original paints onto a `<canvas>`; this port uses a DOM fill, which is
 * testable under JSDOM and updates cheaply via the coalesced render loop. Base
 * for {@link AuxLevelMeter}.
 *
 * @demo
 * ```html
 * <aux-meter value="-12" min="-60" max="0" layout="left"></aux-meter>
 * ```
 *
 * @remarks
 * Attributes: `value`, `base`, `min`, `max`, `layout` (left/right/top/bottom),
 * `segments` (0 = continuous), `scale`.
 */
import { WidgetBase } from '../core/widget-base.js';
import { Range, type ScaleLaw } from '../core/range.js';

export class AuxMeter extends WidgetBase {
    protected range = new Range({ min: 0, max: 1 });
    protected _value = 0;

    static get observedAttributes(): string[] {
        return ['value', 'base', 'min', 'max', 'layout', 'segments', 'scale'];
    }

    get value(): number {
        return this._value;
    }
    set value(v: number) {
        const next = this.range.clamp(v);
        this._value = next;
        this.setAttribute('aria-valuenow', String(next));
        this.onValueChanged(next);
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

    protected get vertical(): boolean {
        const l = this.getAttribute('layout') ?? 'left';
        return l === 'left' || l === 'right';
    }

    /** Hook for subclasses (peak-hold, clip detection). */
    protected onValueChanged(_v: number): void {}

    /** Hook for subclasses to inject extra markup (hold marker) into the track. */
    protected overlayMarkup(): string {
        return '';
    }

    connectedCallback(): void {
        if (this.hasAttribute('min')) this.range.set('min', this.numAttr('min', 0));
        if (this.hasAttribute('max')) this.range.set('max', this.numAttr('max', 1));
        if (this.hasAttribute('scale')) this.range.set('scale', this.getAttribute('scale') as ScaleLaw);
        this._value = this.range.clamp(this.numAttr('value', 0));
        if (!this.hasAttribute('role')) this.setAttribute('role', 'meter');
        this.setAttribute('aria-valuemin', String(this.range.options.min));
        this.setAttribute('aria-valuemax', String(this.range.options.max));
        this.setAttribute('aria-valuenow', String(this._value));
        super.connectedCallback();
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
        if (value === null && name !== 'base') return;
        switch (name) {
            case 'value': this.value = parseFloat(value ?? '0'); break;
            case 'min': this.min = parseFloat(value ?? '0'); break;
            case 'max': this.max = parseFloat(value ?? '1'); break;
            default: this.requestUpdate();
        }
    }

    /** Coefficient of the fill's low and high edges (base ↔ value). */
    protected fillEdges(): { low: number; high: number } {
        const valueCoef = this.range.valueToCoef(this._value);
        const baseAttr = this.getAttribute('base');
        const baseCoef = baseAttr !== null ? this.range.valueToCoef(parseFloat(baseAttr)) : 0;
        let low = Math.min(baseCoef, valueCoef);
        let high = Math.max(baseCoef, valueCoef);
        const segments = this.numAttr('segments', 0);
        if (segments > 0) {
            high = Math.ceil(high * segments) / segments;
            low = Math.floor(low * segments) / segments;
        }
        return { low, high };
    }

    protected render(): void {
        const { low, high } = this.fillEdges();
        const vertical = this.vertical;
        const offset = low * 100;
        const size = (high - low) * 100;
        const fill = vertical
            ? `left: 0; right: 0; bottom: ${offset}%; height: ${size}%;`
            : `top: 0; bottom: 0; left: ${offset}%; width: ${size}%;`;

        this.root.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    width: var(--aux-meter-width, ${vertical ? '16px' : '200px'});
                    height: var(--aux-meter-height, ${vertical ? '160px' : '16px'});
                }
                .track { position: relative; width: 100%; height: 100%; background: var(--aux-track, #222); border-radius: 3px; overflow: hidden; }
                .fill { position: absolute; background: var(--aux-meter-fill, linear-gradient(0deg, #2ecc71, #f1c40f, #e74c3c)); }
                .hold { position: absolute; background: var(--aux-hand, #fff); }
            </style>
            <div class="track" part="track">
                <div class="fill" part="value" style="${fill}"></div>
                ${this.overlayMarkup()}
            </div>
        `;
    }
}

if (!customElements.get('aux-meter')) {
    customElements.define('aux-meter', AuxMeter);
}
