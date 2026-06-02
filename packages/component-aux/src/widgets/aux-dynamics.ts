/**
 * A dynamics processor transfer curve (input dB → output dB).
 *
 * Clean-room reimplementation of AUX's `Dynamics` (original code, MIT), extending
 * {@link AuxChart}. Draws the static gain characteristic of a
 * compressor/limiter/gate/expander. Subclassed by {@link AuxCompressor} and
 * {@link AuxGate}.
 *
 * @demo
 * ```html
 * <aux-dynamics type="compressor" threshold="-20" ratio="4" knee="6"></aux-dynamics>
 * ```
 *
 * @remarks
 * Attributes: `type` (compressor/limiter/gate/expander), `threshold`, `ratio`,
 * `knee`, `range`. Plus the {@link AuxChart} range attributes.
 */
import { AuxChart } from './aux-chart.js';

export type DynamicsType = 'compressor' | 'limiter' | 'gate' | 'expander';

export class AuxDynamics extends AuxChart {
    static get observedAttributes(): string[] {
        return [...AuxChart.observedAttributes, 'type', 'threshold', 'ratio', 'knee', 'range'];
    }

    get threshold(): number {
        return this.numAttr('threshold', -24);
    }
    get ratio(): number {
        return this.numAttr('ratio', 4);
    }
    get knee(): number {
        return this.numAttr('knee', 0);
    }
    get rangeDb(): number {
        return this.numAttr('range', -60);
    }
    get type(): DynamicsType {
        return (this.getAttribute('type') as DynamicsType) ?? 'compressor';
    }

    connectedCallback(): void {
        if (!this.hasAttribute('x-min')) this.setAttribute('x-min', '-60');
        if (!this.hasAttribute('x-max')) this.setAttribute('x-max', '0');
        if (!this.hasAttribute('y-min')) this.setAttribute('y-min', '-60');
        if (!this.hasAttribute('y-max')) this.setAttribute('y-max', '0');
        super.connectedCallback();
    }

    /** Output level (dB) for a given input level (dB). */
    transfer(input: number): number {
        const t = this.threshold;
        const ratio = Math.max(1, this.ratio);
        const knee = this.knee;
        const type = this.type;

        if (type === 'compressor' || type === 'limiter') {
            const r = type === 'limiter' ? 1000 : ratio;
            const over = input - t;
            if (knee > 0 && Math.abs(over) <= knee / 2) {
                // Soft knee: quadratic interpolation around the threshold.
                const x = over + knee / 2;
                return input + (1 / r - 1) * (x * x) / (2 * knee);
            }
            return over <= 0 ? input : t + over / r;
        }

        // Downward expander / gate: attenuate below the threshold.
        const r = type === 'gate' ? 1000 : ratio;
        if (input >= t) return input;
        const expanded = t + (input - t) * r;
        const floor = input + this.rangeDb; // rangeDb is negative — max attenuation
        return Math.max(expanded, floor);
    }

    /** The transfer characteristic sampled across the x-range. */
    transferCurve(steps = 100): Array<[number, number]> {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= steps; i++) {
            const input = this.xRange.coefToValue(i / steps);
            pts.push([input, this.transfer(input)]);
        }
        return pts;
    }

    protected override overlayMarkup(): string {
        // Unity reference line plus the transfer curve.
        const xMin = this.xRange.options.min;
        const xMax = this.xRange.options.max;
        const unity = `<polyline class="unity" part="grid" fill="none" stroke="var(--aux-grid, #444)"
            stroke-dasharray="4 4" stroke-width="1" points="${this.polyline([[xMin, xMin], [xMax, xMax]])}" />`;
        const curve = `<polyline class="transfer" part="graph" fill="none"
            stroke="var(--aux-accent, #3b82f6)" stroke-width="2" points="${this.polyline(this.transferCurve())}" />`;
        return `${unity}${curve}`;
    }
}

if (!customElements.get('aux-dynamics')) {
    customElements.define('aux-dynamics', AuxDynamics);
}

/** A {@link AuxDynamics} preset fixed to `type="compressor"`. */
export class AuxCompressor extends AuxDynamics {
    get type(): DynamicsType {
        return (this.getAttribute('type') as DynamicsType) ?? 'compressor';
    }
}
if (!customElements.get('aux-compressor')) {
    customElements.define('aux-compressor', AuxCompressor);
}

/** A {@link AuxDynamics} preset fixed to `type="gate"`. */
export class AuxGate extends AuxDynamics {
    get type(): DynamicsType {
        return (this.getAttribute('type') as DynamicsType) ?? 'gate';
    }
}
if (!customElements.get('aux-gate')) {
    customElements.define('aux-gate', AuxGate);
}
