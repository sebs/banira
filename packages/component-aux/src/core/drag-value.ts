/**
 * DragValue — turns pointer drags on an element into value changes through a
 * {@link Range}. Clean-room reimplementation of AUX's `DragValue` behaviour.
 *
 * Three drag modes (the AUX `direction` option):
 * - `vertical`   — upward drag increases (screen y is inverted).
 * - `horizontal` — rightward drag increases.
 * - `polar`      — movement projected onto an axis at `rotation` degrees, with a
 *   `blind_angle` dead-zone; lets a knob respond to natural circular gestures.
 *
 * Movement is integrated: the value changes by the projected pixel delta mapped
 * through `range.pixelToValue` relative to the value at drag start.
 */
import type { Range } from './range.js';

export interface DragValueOptions {
    /** Drag mode. */
    direction: 'polar' | 'vertical' | 'horizontal';
    /** Polar axis of positive change, in degrees (0 = up). */
    rotation: number;
    /** Polar dead-zone half-angle, in degrees. */
    blind_angle: number;
    /** Pixel travel spanning the whole range. */
    basis: number;
    /** Invert travel. */
    reverse: boolean;
    /** Read the current value. */
    get: () => number;
    /** Write a value (already range-mapped); should perform the user-set. */
    set: (value: number) => void;
}

const DEFAULTS: Omit<DragValueOptions, 'get' | 'set'> = {
    direction: 'polar',
    rotation: 45,
    blind_angle: 20,
    basis: 300,
    reverse: false,
};

/** Projects a pointer delta (px) onto the configured drag axis, in pixels. */
export function projectDelta(
    dx: number,
    dy: number,
    o: Pick<DragValueOptions, 'direction' | 'rotation' | 'blind_angle' | 'reverse'>
): number {
    let delta: number;
    if (o.direction === 'vertical') {
        delta = -dy;
    } else if (o.direction === 'horizontal') {
        delta = dx;
    } else {
        // polar: project (dx, -dy) onto the unit axis at `rotation` (0 = up).
        const a = (o.rotation * Math.PI) / 180;
        const axisX = Math.sin(a);
        const axisY = Math.cos(a);
        const moveAngle = Math.atan2(dx, -dy); // 0 = up, clockwise
        const diff = Math.abs(normalizeAngle(moveAngle - a));
        // Inside the blind cone perpendicular to the axis → ignore.
        const blind = (o.blind_angle * Math.PI) / 180;
        if (Math.abs(diff - Math.PI / 2) < blind) return 0;
        delta = dx * axisX + -dy * axisY;
    }
    return o.reverse ? -delta : delta;
}

/** Normalises an angle to `(-PI, PI]`. */
function normalizeAngle(a: number): number {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
}

/**
 * Attaches pointer-drag handling to `node`. Returns a disposer that removes all
 * listeners. Emits via the supplied `set` callback as the value changes.
 */
export function attachDragValue(
    node: HTMLElement,
    range: Range,
    options: Partial<DragValueOptions> & Pick<DragValueOptions, 'get' | 'set'>,
    hooks: { onStart?: () => void; onEnd?: () => void } = {}
): () => void {
    const o: DragValueOptions = { ...DEFAULTS, ...options };
    let startX = 0;
    let startY = 0;
    let startValue = 0;
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
        if (!dragging) return;
        const px = projectDelta(ev.clientX - startX, ev.clientY - startY, o);
        // basis pixels == full span; convert the start value to pixels, add the
        // projected delta, map back.
        range.set('basis', o.basis);
        const startPixel = range.valueToPixel(startValue);
        const next = range.snap(range.pixelToValue(startPixel + px));
        o.set(next);
    };

    const onUp = (ev: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        node.releasePointerCapture?.(ev.pointerId);
        node.removeEventListener('pointermove', onMove);
        node.removeEventListener('pointerup', onUp);
        node.removeEventListener('pointercancel', onUp);
        hooks.onEnd?.();
    };

    const onDown = (ev: PointerEvent) => {
        if (ev.button !== 0) return;
        dragging = true;
        startX = ev.clientX;
        startY = ev.clientY;
        startValue = o.get();
        node.setPointerCapture?.(ev.pointerId);
        node.addEventListener('pointermove', onMove);
        node.addEventListener('pointerup', onUp);
        node.addEventListener('pointercancel', onUp);
        hooks.onStart?.();
        ev.preventDefault();
    };

    node.addEventListener('pointerdown', onDown);
    return () => {
        node.removeEventListener('pointerdown', onDown);
        node.removeEventListener('pointermove', onMove);
        node.removeEventListener('pointerup', onUp);
        node.removeEventListener('pointercancel', onUp);
    };
}
