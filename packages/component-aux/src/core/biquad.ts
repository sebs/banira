/**
 * Biquad filter math for the equalizer's frequency-response curve.
 *
 * Implements the standard Audio-EQ-Cookbook (RBJ) coefficient formulas — these
 * are public-domain mathematical facts — and evaluates the magnitude response
 * |H(e^jw)| in dB. Original code.
 */

export type FilterType =
    | 'peaking'
    | 'lowshelf'
    | 'highshelf'
    | 'lowpass'
    | 'highpass'
    | 'notch';

export interface FilterBand {
    type: FilterType;
    /** Centre / corner frequency in Hz. */
    freq: number;
    /** Gain in dB (used by peaking / shelf types). */
    gain: number;
    /** Quality factor. */
    q: number;
    enabled?: boolean;
}

export interface BiquadCoeffs {
    b0: number;
    b1: number;
    b2: number;
    a0: number;
    a1: number;
    a2: number;
}

/** Computes biquad coefficients for a band at the given sample rate. */
export function biquadCoeffs(band: FilterBand, sampleRate: number): BiquadCoeffs {
    const A = Math.pow(10, band.gain / 40);
    const w0 = (2 * Math.PI * band.freq) / sampleRate;
    const cos = Math.cos(w0);
    const sin = Math.sin(w0);
    const alpha = sin / (2 * Math.max(1e-6, band.q));

    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;

    switch (band.type) {
        case 'peaking':
            b0 = 1 + alpha * A;
            b1 = -2 * cos;
            b2 = 1 - alpha * A;
            a0 = 1 + alpha / A;
            a1 = -2 * cos;
            a2 = 1 - alpha / A;
            break;
        case 'lowshelf': {
            const tsa = 2 * Math.sqrt(A) * alpha;
            b0 = A * (A + 1 - (A - 1) * cos + tsa);
            b1 = 2 * A * (A - 1 - (A + 1) * cos);
            b2 = A * (A + 1 - (A - 1) * cos - tsa);
            a0 = A + 1 + (A - 1) * cos + tsa;
            a1 = -2 * (A - 1 + (A + 1) * cos);
            a2 = A + 1 + (A - 1) * cos - tsa;
            break;
        }
        case 'highshelf': {
            const tsa = 2 * Math.sqrt(A) * alpha;
            b0 = A * (A + 1 + (A - 1) * cos + tsa);
            b1 = -2 * A * (A - 1 + (A + 1) * cos);
            b2 = A * (A + 1 + (A - 1) * cos - tsa);
            a0 = A + 1 - (A - 1) * cos + tsa;
            a1 = 2 * (A - 1 - (A + 1) * cos);
            a2 = A + 1 - (A - 1) * cos - tsa;
            break;
        }
        case 'lowpass':
            b0 = (1 - cos) / 2;
            b1 = 1 - cos;
            b2 = (1 - cos) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cos;
            a2 = 1 - alpha;
            break;
        case 'highpass':
            b0 = (1 + cos) / 2;
            b1 = -(1 + cos);
            b2 = (1 + cos) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cos;
            a2 = 1 - alpha;
            break;
        case 'notch':
            b0 = 1;
            b1 = -2 * cos;
            b2 = 1;
            a0 = 1 + alpha;
            a1 = -2 * cos;
            a2 = 1 - alpha;
            break;
    }

    return { b0, b1, b2, a0, a1, a2 };
}

/** Magnitude response of a coefficient set at `freq`, in dB. */
export function magnitudeDb(c: BiquadCoeffs, freq: number, sampleRate: number): number {
    const w = (2 * Math.PI * freq) / sampleRate;
    const cosw = Math.cos(w);
    const sinw = Math.sin(w);
    const cos2w = Math.cos(2 * w);
    const sin2w = Math.sin(2 * w);
    // numerator b0 + b1 e^-jw + b2 e^-2jw
    const numRe = c.b0 + c.b1 * cosw + c.b2 * cos2w;
    const numIm = -(c.b1 * sinw + c.b2 * sin2w);
    const denRe = c.a0 + c.a1 * cosw + c.a2 * cos2w;
    const denIm = -(c.a1 * sinw + c.a2 * sin2w);
    const num = Math.hypot(numRe, numIm);
    const den = Math.hypot(denRe, denIm) || 1e-12;
    return 20 * Math.log10(num / den);
}

/** Response of a single band at a frequency, in dB. */
export function bandResponseDb(band: FilterBand, freq: number, sampleRate = 44100): number {
    if (band.enabled === false) return 0;
    return magnitudeDb(biquadCoeffs(band, sampleRate), freq, sampleRate);
}

/** Summed response of all bands at a frequency, in dB. */
export function combinedResponseDb(bands: FilterBand[], freq: number, sampleRate = 44100): number {
    let total = 0;
    for (const band of bands) total += bandResponseDb(band, freq, sampleRate);
    return total;
}
