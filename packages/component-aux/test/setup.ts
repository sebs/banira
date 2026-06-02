/**
 * Installs a JSDOM environment on the global scope so widget modules (which call
 * customElements.define at import time) can be imported in plain Node tests.
 * Must be imported before any widget module.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost',
});

const w = dom.window as unknown as Record<string, unknown>;
const g = globalThis as unknown as Record<string, unknown>;

for (const key of [
    'window',
    'document',
    'HTMLElement',
    'customElements',
    'CustomEvent',
    'Event',
    'KeyboardEvent',
    'MouseEvent',
    'WheelEvent',
    'Node',
]) {
    try {
        if (key === 'window') g.window = dom.window;
        else if (w[key] !== undefined) g[key] = w[key];
    } catch {
        // Some globals (e.g. navigator) are read-only in newer Node; skip them.
    }
}

/** Flushes pending microtasks (coalesced renders) before assertions. */
export function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
