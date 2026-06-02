import './setup.js';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { flush } from './setup.js';
import '../src/index.js';

function make(tag: string, attrs: Record<string, string | number> = {}): HTMLElement {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    document.body.appendChild(el);
    return el;
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('aux-knob', () => {
    it('clamps the initial value into range', () => {
        const knob = make('aux-knob', { min: 0, max: 10, value: 20 }) as HTMLElement & { value: number };
        assert.equal(knob.value, 10);
        assert.equal(knob.getAttribute('aria-valuenow'), '10');
    });

    it('exposes ARIA slider semantics', () => {
        const knob = make('aux-knob', { min: -60, max: 6, value: 0 });
        assert.equal(knob.getAttribute('role'), 'slider');
        assert.equal(knob.getAttribute('aria-valuemin'), '-60');
        assert.equal(knob.getAttribute('aria-valuemax'), '6');
        assert.equal(knob.getAttribute('tabindex'), '0');
    });

    it('increments on ArrowUp and emits input + change', () => {
        const knob = make('aux-knob', { min: 0, max: 100, step: 1, value: 50 }) as HTMLElement & { value: number };
        let input = 0;
        let change = 0;
        knob.addEventListener('input', () => input++);
        knob.addEventListener('change', () => change++);
        knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        assert.equal(knob.value, 51);
        assert.equal(input, 1);
        assert.equal(change, 1);
    });

    it('Home/End jump to the extremes', () => {
        const knob = make('aux-knob', { min: 0, max: 100, value: 50 }) as HTMLElement & { value: number };
        knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
        assert.equal(knob.value, 100);
        knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
        assert.equal(knob.value, 0);
    });

    it('does not respond to keys when disabled', () => {
        const knob = make('aux-knob', { min: 0, max: 100, value: 50, disabled: '' }) as HTMLElement & { value: number };
        knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        assert.equal(knob.value, 50);
    });

    it('renders an SVG arc after update', async () => {
        const knob = make('aux-knob', { min: 0, max: 1, value: 0.5, size: 100 });
        await flush();
        const paths = knob.shadowRoot!.querySelectorAll('path');
        assert.equal(paths.length, 2, 'track + value arcs');
        assert.ok(knob.shadowRoot!.querySelector('line.hand'), 'has a hand');
    });
});

describe('aux-fader', () => {
    it('sets aria-orientation from layout', () => {
        const fader = make('aux-fader', { layout: 'top', min: 0, max: 1, value: 0.5 });
        assert.equal(fader.getAttribute('aria-orientation'), 'horizontal');
        const vertical = make('aux-fader', { layout: 'left', min: 0, max: 1, value: 0.5 });
        assert.equal(vertical.getAttribute('aria-orientation'), 'vertical');
    });
});

describe('aux-toggle', () => {
    it('flips state and emits toggled on click', () => {
        const toggle = make('aux-toggle', { label: 'Mute' }) as HTMLElement & { state: boolean };
        let detail: unknown = null;
        toggle.addEventListener('toggled', (e) => {
            detail = (e as CustomEvent).detail;
        });
        toggle.click();
        assert.equal(toggle.state, true);
        assert.equal(toggle.getAttribute('aria-pressed'), 'true');
        assert.deepEqual(detail, { state: true });
        toggle.click();
        assert.equal(toggle.state, false);
    });

    it('respects toggle="false" (momentary)', () => {
        const toggle = make('aux-toggle', { toggle: 'false' }) as HTMLElement & { state: boolean };
        toggle.click();
        assert.equal(toggle.state, false);
    });

    it('shows the active label when toggled', async () => {
        const toggle = make('aux-toggle', { label: 'Mute', 'label-active': 'Muted' }) as HTMLElement & { state: boolean };
        toggle.click();
        await flush();
        assert.match(toggle.shadowRoot!.innerHTML, /Muted/);
    });
});

describe('aux-button', () => {
    it('emits clicked', () => {
        const button = make('aux-button', { label: 'Go' });
        let clicked = 0;
        button.addEventListener('clicked', () => clicked++);
        button.click();
        assert.equal(clicked, 1);
    });

    it('does not emit when disabled', () => {
        const button = make('aux-button', { label: 'Go', disabled: '' });
        let clicked = 0;
        button.addEventListener('clicked', () => clicked++);
        button.click();
        assert.equal(clicked, 0);
    });
});

describe('aux-label', () => {
    it('renders and escapes its text', async () => {
        const label = make('aux-label', { label: '<b>Gain</b>' });
        await flush();
        assert.match(label.shadowRoot!.innerHTML, /&lt;b&gt;Gain/);
    });
});
