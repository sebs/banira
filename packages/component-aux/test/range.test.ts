import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Range } from '../src/core/range.js';

const closeTo = (a: number, b: number, eps = 1e-9) =>
    assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

describe('Range', () => {
    describe('linear scale', () => {
        it('maps value to coefficient', () => {
            const r = new Range({ min: 0, max: 100 });
            closeTo(r.valueToCoef(0), 0);
            closeTo(r.valueToCoef(50), 0.5);
            closeTo(r.valueToCoef(100), 1);
        });

        it('round-trips value ↔ coef', () => {
            const r = new Range({ min: -60, max: 6 });
            for (const v of [-60, -24, 0, 6]) {
                closeTo(r.coefToValue(r.valueToCoef(v)), v, 1e-6);
            }
        });

        it('reverse inverts the coefficient', () => {
            const r = new Range({ min: 0, max: 10, reverse: true });
            closeTo(r.valueToCoef(0), 1);
            closeTo(r.valueToCoef(10), 0);
        });
    });

    describe('clamp', () => {
        it('clamps into range when clip is on', () => {
            const r = new Range({ min: 0, max: 10 });
            assert.equal(r.clamp(-5), 0);
            assert.equal(r.clamp(15), 10);
            assert.equal(r.clamp(5), 5);
        });
        it('does not clamp when clip is off', () => {
            const r = new Range({ min: 0, max: 10, clip: false });
            assert.equal(r.clamp(15), 15);
        });
    });

    describe('snap', () => {
        it('snaps to a numeric grid', () => {
            const r = new Range({ min: 0, max: 100, snap: 25 });
            assert.equal(r.snap(33), 25);
            assert.equal(r.snap(38), 50);
        });
        it('snaps to explicit points', () => {
            const r = new Range({ min: 0, max: 100, snap: [0, 10, 90] });
            assert.equal(r.snap(4), 0);
            assert.equal(r.snap(7), 10);
            assert.equal(r.snap(80), 90);
        });
        it('falls back to step', () => {
            const r = new Range({ min: 0, max: 10, step: 2 });
            assert.equal(r.snap(3), 4);
            assert.equal(r.snap(0.9), 0);
        });
    });

    describe('logarithmic scale', () => {
        it('round-trips on a positive range', () => {
            const r = new Range({ min: 20, max: 20000, scale: 'logarithmic' });
            for (const v of [20, 200, 2000, 20000]) {
                closeTo(r.coefToValue(r.valueToCoef(v)), v, 1e-3);
            }
        });
        it('places the geometric midpoint near coef 0.5', () => {
            const r = new Range({ min: 20, max: 20000, scale: 'logarithmic' });
            // geometric mean of 20 and 20000 is ~632
            closeTo(r.valueToCoef(632.45), 0.5, 1e-3);
        });
    });

    describe('decibel scale', () => {
        it('round-trips', () => {
            const r = new Range({ min: 0, max: 1, scale: 'decibel', log_factor: 4 });
            for (const v of [0, 0.25, 0.5, 1]) {
                closeTo(r.coefToValue(r.valueToCoef(v)), v, 1e-6);
            }
        });
    });

    describe('pixel helpers', () => {
        it('maps via basis', () => {
            const r = new Range({ min: 0, max: 100, basis: 200 });
            closeTo(r.valueToPixel(50), 100);
            closeTo(r.pixelToValue(100), 50);
        });
    });
});
