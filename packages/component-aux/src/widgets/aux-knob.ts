/**
 * A rotary knob control for audio parameters.
 *
 * Clean-room reimplementation of AUX's `Knob` (GPLv3 original; this code is
 * original, MIT). Renders a circular gauge in SVG and is driven by pointer drag
 * (polar), mouse wheel, and the keyboard. Fully accessible as an ARIA slider.
 *
 * @demo
 * ```html
 * <aux-knob value="64" min="0" max="127" size="120"></aux-knob>
 * ```
 *
 * @remarks
 * Attributes: `value`, `min`, `max`, `step`, `scale`, `size`, `disabled`.
 * Emits `input` while turning and `change` when a gesture commits.
 */
import { ValueWidget } from '../core/value-widget.js';
import type { DragValueOptions } from '../core/drag-value.js';
import { describeArc, coefToAngle, polarToCartesian } from '../core/svg.js';

const START_ANGLE = 135;
const SWEEP_ANGLE = 270;

export class AuxKnob extends ValueWidget {
    static get observedAttributes(): string[] {
        return [...ValueWidget.observedAttributes, 'size', 'thickness'];
    }

    get size(): number {
        return this.numAttr('size', 100);
    }
    set size(v: number) {
        this.setAttribute('size', String(v));
    }

    attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
        if (name === 'size' || name === 'thickness') {
            this.requestUpdate();
            return;
        }
        super.attributeChangedCallback(name, oldValue, value);
    }

    protected dragOptions(): Partial<DragValueOptions> {
        return { direction: 'polar', rotation: 45, blind_angle: 20, basis: 300 };
    }

    protected renderControl(): void {
        const size = this.size;
        const thickness = this.numAttr('thickness', 6);
        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2 - thickness;
        const coef = this.coef();
        const valueAngle = coefToAngle(coef, START_ANGLE, SWEEP_ANGLE);

        const baseArc = describeArc(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP_ANGLE);
        const valueArc = describeArc(cx, cy, r, START_ANGLE, valueAngle);
        const handStart = polarToCartesian(cx, cy, r * 0.35, valueAngle);
        const handEnd = polarToCartesian(cx, cy, r * 0.92, valueAngle);

        this.root.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    width: var(--aux-knob-size, ${size}px);
                    height: var(--aux-knob-size, ${size}px);
                    cursor: pointer;
                    outline: none;
                    touch-action: none;
                }
                :host([disabled]) { opacity: 0.5; pointer-events: none; }
                :host(:focus-visible) .knob { filter: drop-shadow(0 0 3px var(--aux-accent, #3b82f6)); }
                svg { width: 100%; height: 100%; display: block; }
                .track { fill: none; stroke: var(--aux-track, #444); stroke-width: ${thickness}; stroke-linecap: round; }
                .value { fill: none; stroke: var(--aux-accent, #3b82f6); stroke-width: ${thickness}; stroke-linecap: round; }
                .hand { stroke: var(--aux-hand, #fff); stroke-width: 2; stroke-linecap: round; }
            </style>
            <div class="knob" part="knob">
                <svg viewBox="0 0 ${size} ${size}">
                    <path class="track" part="track" d="${baseArc}"></path>
                    <path class="value" part="value" d="${valueArc}"></path>
                    <line class="hand" part="hand"
                          x1="${handStart.x.toFixed(2)}" y1="${handStart.y.toFixed(2)}"
                          x2="${handEnd.x.toFixed(2)}" y2="${handEnd.y.toFixed(2)}"></line>
                </svg>
            </div>
        `;
    }
}

if (!customElements.get('aux-knob')) {
    customElements.define('aux-knob', AuxKnob);
}
