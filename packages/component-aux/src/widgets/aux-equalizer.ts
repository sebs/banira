/**
 * A parametric equalizer — a frequency-response curve with draggable band
 * handles.
 *
 * Clean-room reimplementation of AUX's `Equalizer` (original code, MIT),
 * extending {@link AuxChart}. The combined biquad response of all bands is drawn
 * as a curve; each band has a handle you can drag (x = frequency, y = gain).
 *
 * @demo
 * ```html
 * <aux-equalizer width="480" height="220"></aux-equalizer>
 * ```
 *
 * @remarks
 * Set `bands` (property) to `[{ type, freq, gain, q }]`. Emits `input` while
 * dragging a band and `change` on release, with `{ index, band }`.
 */
import { AuxChart } from './aux-chart.js';
import { combinedResponseDb, type FilterBand } from '../core/biquad.js';

export class AuxEqualizer extends AuxChart {
    private _bands: FilterBand[] = [];
    /** Sample rate used for the response computation. */
    sampleRate = 44100;
    private dragIndex = -1;
    private disposers: Array<() => void> = [];

    get bands(): FilterBand[] {
        return this._bands;
    }
    set bands(b: FilterBand[]) {
        this._bands = b;
        this.requestUpdate();
    }

    connectedCallback(): void {
        // Sensible EQ defaults if the host didn't specify ranges.
        if (!this.hasAttribute('x-min')) this.setAttribute('x-min', '20');
        if (!this.hasAttribute('x-max')) this.setAttribute('x-max', '20000');
        if (!this.hasAttribute('x-scale')) this.setAttribute('x-scale', 'logarithmic');
        if (!this.hasAttribute('y-min')) this.setAttribute('y-min', '-24');
        if (!this.hasAttribute('y-max')) this.setAttribute('y-max', '24');
        super.connectedCallback();
    }

    disconnectedCallback(): void {
        this.disposers.forEach((d) => d());
        this.disposers = [];
    }

    /** The combined response sampled across the x-range, as `[freq, gain]` points. */
    responseCurve(steps = 120): Array<[number, number]> {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= steps; i++) {
            const freq = this.xRange.coefToValue(i / steps);
            pts.push([freq, combinedResponseDb(this._bands, freq, this.sampleRate)]);
        }
        return pts;
    }

    protected override overlayMarkup(): string {
        const curve = `<polyline class="response" part="graph" fill="none"
            stroke="var(--aux-accent, #3b82f6)" stroke-width="2"
            points="${this.polyline(this.responseCurve())}" />`;
        const handles = this._bands
            .map((b, i) => {
                const cx = this.toX(b.freq).toFixed(2);
                const cy = this.toY(b.gain).toFixed(2);
                return `<circle class="handle" part="handle" data-band="${i}" r="7" cx="${cx}" cy="${cy}"></circle>`;
            })
            .join('');
        return `${curve}${handles}`;
    }

    protected override render(): void {
        super.render();
        // Re-bind drag handlers to the freshly rendered handles.
        this.disposers.forEach((d) => d());
        this.disposers = [];
        const handles = this.root.querySelectorAll('[data-band]');
        handles.forEach((handle) => {
            const onDown = (ev: Event) => this.startDrag(parseInt((handle as HTMLElement).getAttribute('data-band')!, 10), ev as PointerEvent);
            handle.addEventListener('pointerdown', onDown as EventListener);
            this.disposers.push(() => handle.removeEventListener('pointerdown', onDown as EventListener));
        });
        // Style for handles (added once into the existing <style>).
        const style = this.root.querySelector('style');
        if (style && !style.textContent!.includes('.handle')) {
            style.textContent += `
                .response { pointer-events: none; }
                .handle { fill: var(--aux-accent, #3b82f6); stroke: #fff; stroke-width: 2; cursor: grab; }
                .handle:active { cursor: grabbing; }`;
        }
    }

    private startDrag(index: number, ev: PointerEvent): void {
        const band = this._bands[index];
        if (!band) return;
        this.dragIndex = index;
        const svg = this.root.querySelector('svg') as SVGSVGElement;
        const rect = svg.getBoundingClientRect();

        const move = (e: PointerEvent) => {
            const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * this.width;
            const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * this.height;
            band.freq = this.fromX(px);
            band.gain = this.fromY(py);
            this.requestUpdate();
            this.emit('input', { index, band });
        };
        const up = () => {
            window.removeEventListener('pointermove', move as EventListener);
            window.removeEventListener('pointerup', up as EventListener);
            this.dragIndex = -1;
            this.emit('change', { index, band });
        };
        window.addEventListener('pointermove', move as EventListener);
        window.addEventListener('pointerup', up as EventListener);
        ev.preventDefault();
    }
}

if (!customElements.get('aux-equalizer')) {
    customElements.define('aux-equalizer', AuxEqualizer);
}
