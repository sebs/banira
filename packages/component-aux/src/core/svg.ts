/**
 * SVG helpers for circular controls (knob, gauge). Pure geometry — no DOM
 * dependency beyond producing path strings — so the maths can be unit-tested
 * without a renderer.
 *
 * Angles follow the AUX convention: degrees, clockwise, where the arc begins at
 * `start` (default 135°) and spans `angle` degrees (default 270°). 0° points to
 * the right (standard SVG), so a knob's "down" gap is centred at 90°.
 */

export interface PolarPoint {
    x: number;
    y: number;
}

/** Converts a polar coordinate (degrees, clockwise) to cartesian. */
export function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): PolarPoint {
    const a = (angleDeg * Math.PI) / 180;
    return {
        x: cx + radius * Math.cos(a),
        y: cy + radius * Math.sin(a),
    };
}

/**
 * Builds an SVG arc path string from `startAngle` to `endAngle` (degrees,
 * clockwise) at the given radius. Returns an empty string for a zero-length arc.
 */
export function describeArc(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
): string {
    if (Math.abs(endAngle - startAngle) < 1e-6) return '';
    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
    const sweep = endAngle > startAngle ? 1 : 0;
    return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

/**
 * Maps a coefficient in `[0, 1]` to an absolute angle within the
 * `[start, start + angle]` sweep.
 */
export function coefToAngle(coef: number, start: number, angle: number): number {
    return start + Math.min(1, Math.max(0, coef)) * angle;
}
