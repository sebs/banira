/**
 * A read-only circular gauge.
 *
 * Clean-room reimplementation of AUX's `Gauge` (original code, MIT). Displays a
 * value as a filled arc with an optional centre label. No interaction.
 *
 * @demo
 * ```html
 * <aux-gauge value="0.7" min="0" max="1" size="120" label="CPU"></aux-gauge>
 * ```
 *
 * @remarks
 * Attributes: `value`, `min`, `max`, `size`, `label`, `scale`.
 */
import { WidgetBase } from '../core/widget-base.js';
import { Range, type ScaleLaw } from '../core/range.js';
import { describeArc, coefToAngle } from '../core/svg.js';

const START_ANGLE = 135;
const SWEEP_ANGLE = 270;

export class AuxGauge extends WidgetBase {
    private range = new Range();
    private _value = 0;

    static get observedAttributes(): string[] {
        return ['value', 'min', 'max', 'size', 'label', 'scale'];
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

    get size(): number {
        return this.numAttr('size', 100);
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
        if (value === null) return;
        switch (name) {
            case 'value': this.value = parseFloat(value); break;
            case 'min': this.min = parseFloat(value); break;
            case 'max': this.max = parseFloat(value); break;
            case 'scale': this.range.set('scale', value as ScaleLaw); this.requestUpdate(); break;
            default: this.requestUpdate();
        }
    }

    protected render(): void {
        const size = this.size;
        const thickness = this.numAttr('thickness', 8);
        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2 - thickness;
        const coef = this.range.valueToCoef(this._value);
        const track = describeArc(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP_ANGLE);
        const value = describeArc(cx, cy, r, START_ANGLE, coefToAngle(coef, START_ANGLE, SWEEP_ANGLE));
        const label = this.getAttribute('label') ?? '';

        this.root.innerHTML = `
            <style>
                :host { display: inline-block; width: var(--aux-gauge-size, ${size}px); height: var(--aux-gauge-size, ${size}px); }
                svg { width: 100%; height: 100%; display: block; }
                .track { fill: none; stroke: var(--aux-track, #444); stroke-width: ${thickness}; stroke-linecap: round; }
                .value { fill: none; stroke: var(--aux-accent, #3b82f6); stroke-width: ${thickness}; stroke-linecap: round; }
                text { fill: var(--aux-fg, #ddd); font: var(--aux-font, 13px sans-serif); text-anchor: middle; dominant-baseline: middle; }
            </style>
            <svg viewBox="0 0 ${size} ${size}">
                <path class="track" part="track" d="${track}"></path>
                <path class="value" part="value" d="${value}"></path>
                <text class="label" part="label" x="${cx}" y="${cy}">${escapeText(label)}</text>
            </svg>
        `;
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!customElements.get('aux-gauge')) {
    customElements.define('aux-gauge', AuxGauge);
}
