/**
 * ScrollValue — turns mouse-wheel events on an element into value changes
 * through a {@link Range}. Clean-room reimplementation of AUX's `ScrollValue`.
 *
 * Each wheel notch steps the value by `step` (falling back to 1/50th of the
 * range when no step is set), scaled by the Shift / Shift+Ctrl modifiers, in the
 * direction given by `scroll_direction` (default: wheel-up increases).
 */
import type { Range } from './range.js';

export interface ScrollValueOptions {
    /** Per-axis wheel multipliers `[x, y, z]`; default `[0, -1, 0]`. */
    scroll_direction: [number, number, number];
    /** Read the current value. */
    get: () => number;
    /** Write a value; should perform the user-set. */
    set: (value: number) => void;
}

const DEFAULT_DIRECTION: [number, number, number] = [0, -1, 0];

/**
 * Attaches wheel handling to `node`. Returns a disposer removing the listener.
 */
export function attachScrollValue(
    node: HTMLElement,
    range: Range,
    options: ScrollValueOptions,
    hooks: { onScroll?: () => void } = {}
): () => void {
    const direction = options.scroll_direction ?? DEFAULT_DIRECTION;

    const onWheel = (ev: WheelEvent) => {
        const raw = ev.deltaX * direction[0] + ev.deltaY * direction[1] + ev.deltaZ * direction[2];
        if (raw === 0) return;
        const dir = Math.sign(raw);

        const opts = range.options;
        const base = opts.step > 0 ? opts.step : (opts.max - opts.min) / 50;
        let amount = base;
        if (ev.shiftKey && ev.ctrlKey) amount *= opts.shift_down;
        else if (ev.shiftKey) amount *= opts.shift_up;

        const next = range.snap(options.get() + dir * amount);
        options.set(next);
        hooks.onScroll?.();
        ev.preventDefault();
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
}
