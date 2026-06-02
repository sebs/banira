/**
 * Range — the value ↔ coefficient ↔ pixel scaling core shared by all
 * value-bearing widgets (knob, fader, slider, meter).
 *
 * Clean-room reimplementation of the documented AUX `Ranged` API: option names,
 * defaults and the named scale laws are mirrored, the implementation is original.
 *
 * A "coefficient" is the normalised position in `[0, 1]`. `valueToCoef` maps a
 * value in `[min, max]` to that position through the chosen {@link ScaleLaw};
 * `coefToValue` is its exact inverse. Pixel helpers scale the coefficient by
 * `basis`.
 */

/**
 * A scale law maps the linear fraction `lin = (value - min) / (max - min)` to a
 * display coefficient in `[0, 1]`. Built-in laws are referenced by name; a
 * custom law is a pair of mutually-inverse functions.
 */
export type ScaleLaw =
    | 'linear'
    | 'logarithmic'
    | 'frequency'
    | 'frequency-reverse'
    | 'decibel';

export interface RangeOptions {
    /** Scale law, default `'linear'`. */
    scale: ScaleLaw;
    /** Invert the coefficient direction. */
    reverse: boolean;
    /** Size of the linear scale in pixels (used by the pixel helpers). */
    basis: number;
    /** Clamp values into `[min, max]`. */
    clip: boolean;
    /** Minimum range value. */
    min: number;
    /** Maximum range value. */
    max: number;
    /** Anchor used for snap-grid alignment. */
    base: number;
    /** Interaction step; `0` disables stepping. */
    step: number;
    /** Speed multiplier applied with the Shift modifier. */
    shift_up: number;
    /** Speed multiplier applied with the Shift+Ctrl modifier. */
    shift_down: number;
    /** Snap grid spacing (number) or explicit snap points (array). */
    snap: number | number[];
    /** Curvature factor for the logarithmic / decibel laws. */
    log_factor: number;
}

export const RANGE_DEFAULTS: RangeOptions = {
    scale: 'linear',
    reverse: false,
    basis: 1,
    clip: true,
    min: 0,
    max: 1,
    base: 0,
    step: 0,
    shift_up: 4,
    shift_down: 0.25,
    snap: 0,
    log_factor: 1,
};

/**
 * Computes value ↔ coefficient ↔ pixel transforms for a range. All options are
 * read live from the supplied (partial) options object so a widget can hand its
 * own option store in and have changes take effect immediately.
 */
export class Range {
    private readonly o: RangeOptions;

    constructor(options: Partial<RangeOptions> = {}) {
        this.o = { ...RANGE_DEFAULTS, ...options };
    }

    /** Live option accessor (mutating the returned object affects this Range). */
    get options(): RangeOptions {
        return this.o;
    }

    set<K extends keyof RangeOptions>(key: K, value: RangeOptions[K]): void {
        this.o[key] = value;
    }

    /** Clamps a value into `[min, max]` when `clip` is enabled. */
    clamp(value: number): number {
        if (!this.o.clip) return value;
        const lo = Math.min(this.o.min, this.o.max);
        const hi = Math.max(this.o.min, this.o.max);
        return Math.min(hi, Math.max(lo, value));
    }

    /**
     * Quantises a value to the snap grid / explicit snap points, falling back to
     * `step` when no snap is configured. Always clamps the result.
     */
    snap(value: number): number {
        const { snap, step, base } = this.o;
        if (Array.isArray(snap)) {
            if (snap.length === 0) return this.clamp(value);
            let nearest = snap[0];
            for (const point of snap) {
                if (Math.abs(point - value) < Math.abs(nearest - value)) nearest = point;
            }
            return this.clamp(nearest);
        }
        const grid = snap > 0 ? snap : step;
        if (grid > 0) {
            return this.clamp(Math.round((value - base) / grid) * grid + base);
        }
        return this.clamp(value);
    }

    /** Maps a value to its display coefficient in `[0, 1]`. */
    valueToCoef(value: number): number {
        const { min, max, reverse } = this.o;
        const span = max - min;
        const lin = span === 0 ? 0 : (this.clamp(value) - min) / span;
        const coef = this.applyLaw(lin);
        return reverse ? 1 - coef : coef;
    }

    /** Inverse of {@link valueToCoef}. */
    coefToValue(coef: number): number {
        const { min, max, reverse } = this.o;
        const c = reverse ? 1 - coef : coef;
        const lin = this.invertLaw(Math.min(1, Math.max(0, c)));
        return this.clamp(min + lin * (max - min));
    }

    /** Maps a value to a pixel offset (coefficient × `basis`). */
    valueToPixel(value: number): number {
        return this.valueToCoef(value) * this.o.basis;
    }

    /** Inverse of {@link valueToPixel}. */
    pixelToValue(pixel: number): number {
        return this.coefToValue(this.o.basis === 0 ? 0 : pixel / this.o.basis);
    }

    /** Forward scale law: linear fraction → coefficient. */
    private applyLaw(lin: number): number {
        const { scale, min, max, log_factor } = this.o;
        switch (scale) {
            case 'linear':
                return lin;
            case 'logarithmic':
            case 'frequency':
            case 'frequency-reverse': {
                // Geometric (log) position; requires a positive range.
                if (min <= 0 || max <= 0) return lin;
                const coef = Math.log(min + lin * (max - min)) / Math.log(max / min) - Math.log(min) / Math.log(max / min);
                return scale === 'frequency-reverse' ? 1 - coef : coef;
            }
            case 'decibel': {
                // Exponential curve shaped by log_factor; k=0 degrades to linear.
                const k = log_factor;
                if (k === 0) return lin;
                return (Math.exp(k * lin) - 1) / (Math.exp(k) - 1);
            }
            default:
                return lin;
        }
    }

    /** Inverse scale law: coefficient → linear fraction. */
    private invertLaw(coef: number): number {
        const { scale, min, max, log_factor } = this.o;
        switch (scale) {
            case 'linear':
                return coef;
            case 'logarithmic':
            case 'frequency':
            case 'frequency-reverse': {
                if (min <= 0 || max <= 0) return coef;
                const c = scale === 'frequency-reverse' ? 1 - coef : coef;
                const value = min * Math.pow(max / min, c);
                return (value - min) / (max - min);
            }
            case 'decibel': {
                const k = log_factor;
                if (k === 0) return coef;
                return Math.log(coef * (Math.exp(k) - 1) + 1) / k;
            }
            default:
                return coef;
        }
    }
}
