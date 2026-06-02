import { describe, it } from 'node:test';
import assert from 'node:assert';
import { coefToAngle, polarToCartesian, describeArc } from '../src/core/svg.js';
import { projectDelta } from '../src/core/drag-value.js';

const closeTo = (a: number, b: number, eps = 1e-6) =>
    assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

describe('svg geometry', () => {
    it('coefToAngle spans start..start+angle', () => {
        closeTo(coefToAngle(0, 135, 270), 135);
        closeTo(coefToAngle(1, 135, 270), 405);
        closeTo(coefToAngle(0.5, 135, 270), 270);
    });
    it('coefToAngle clamps out-of-range coefficients', () => {
        closeTo(coefToAngle(-1, 135, 270), 135);
        closeTo(coefToAngle(2, 135, 270), 405);
    });
    it('polarToCartesian at 0deg points right', () => {
        const p = polarToCartesian(50, 50, 10, 0);
        closeTo(p.x, 60);
        closeTo(p.y, 50);
    });
    it('describeArc returns empty for zero-length arc', () => {
        assert.equal(describeArc(50, 50, 40, 135, 135), '');
    });
    it('describeArc produces a path with arc flags', () => {
        const d = describeArc(50, 50, 40, 135, 405);
        assert.match(d, /^M /);
        assert.match(d, / A 40 40 /);
    });
});

describe('drag projection', () => {
    const vertical = { direction: 'vertical' as const, rotation: 45, blind_angle: 20, reverse: false };
    const horizontal = { direction: 'horizontal' as const, rotation: 45, blind_angle: 20, reverse: false };

    it('vertical: upward (negative dy) increases', () => {
        assert.equal(projectDelta(0, -10, vertical), 10);
        assert.equal(projectDelta(0, 10, vertical), -10);
    });
    it('horizontal: rightward increases', () => {
        assert.equal(projectDelta(10, 0, horizontal), 10);
    });
    it('reverse inverts', () => {
        assert.equal(projectDelta(0, -10, { ...vertical, reverse: true }), -10);
    });
    it('polar: motion along the axis produces change, dead-zone produces none', () => {
        const polar = { direction: 'polar' as const, rotation: 45, blind_angle: 20, reverse: false };
        // Move perpendicular to the 45° axis → inside the blind cone → 0.
        const dead = projectDelta(Math.cos(Math.PI / 4) * 10, Math.cos(Math.PI / 4) * 10, polar);
        closeTo(dead, 0);
        // Move along the axis → non-zero.
        const along = projectDelta(Math.sin(Math.PI / 4) * 10, -Math.cos(Math.PI / 4) * 10, polar);
        assert.ok(along > 0.5, `expected positive projection, got ${along}`);
    });
});
