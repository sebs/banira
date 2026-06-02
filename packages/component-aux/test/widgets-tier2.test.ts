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

describe('aux-gauge', () => {
    it('clamps value and exposes meter ARIA', () => {
        const g = make('aux-gauge', { min: 0, max: 1, value: 2 }) as HTMLElement & { value: number };
        assert.equal(g.value, 1);
        assert.equal(g.getAttribute('role'), 'meter');
        assert.equal(g.getAttribute('aria-valuemax'), '1');
        assert.equal(g.getAttribute('aria-valuenow'), '1');
    });
    it('renders track + value arcs and a label', async () => {
        const g = make('aux-gauge', { min: 0, max: 1, value: 0.5, label: 'CPU' });
        await flush();
        assert.equal(g.shadowRoot!.querySelectorAll('path').length, 2);
        assert.match(g.shadowRoot!.innerHTML, /CPU/);
    });
});

describe('aux-progressbar', () => {
    it('defaults to 0..100 and reflects value', () => {
        const p = make('aux-progressbar', { value: 42 }) as HTMLElement & { value: number; max: number };
        assert.equal(p.max, 100);
        assert.equal(p.value, 42);
        assert.equal(p.getAttribute('role'), 'progressbar');
        assert.equal(p.getAttribute('aria-valuenow'), '42');
    });
    it('renders a value readout by default', async () => {
        const p = make('aux-progressbar', { value: 42 });
        await flush();
        assert.match(p.shadowRoot!.innerHTML, /42%/);
    });
});

describe('aux-value', () => {
    it('parses numeric input on Enter and emits change', async () => {
        const v = make('aux-value', { value: 0 }) as HTMLElement & { value: number | string };
        await flush();
        const input = v.shadowRoot!.querySelector('input')!;
        let change = 0;
        v.addEventListener('change', () => change++);
        input.value = '12.5';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        assert.equal(v.value, 12.5);
        assert.equal(change, 1);
    });
    it('immediate editmode commits on each input', async () => {
        const v = make('aux-value', { value: 0, editmode: 'immediate' }) as HTMLElement & { value: number | string };
        await flush();
        const input = v.shadowRoot!.querySelector('input')!;
        input.value = '7';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        assert.equal(v.value, 7);
    });
});

describe('aux-valuebutton', () => {
    it('formats and clamps its value', () => {
        const vb = make('aux-valuebutton', { min: 0, max: 10, value: 99 }) as HTMLElement & { value: number };
        assert.equal(vb.value, 10);
        assert.equal(vb.getAttribute('role'), 'slider');
    });
    it('adjusts via keyboard', () => {
        const vb = make('aux-valuebutton', { min: 0, max: 10, step: 1, value: 5 }) as HTMLElement & { value: number };
        vb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        assert.equal(vb.value, 6);
    });
    it('enters edit mode on double-click and commits typed value', async () => {
        const vb = make('aux-valuebutton', { min: 0, max: 100, value: 5 }) as HTMLElement & { value: number };
        vb.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await flush();
        const input = vb.shadowRoot!.querySelector('input')!;
        input.value = '42';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        assert.equal(vb.value, 42);
    });
});

describe('aux-icon', () => {
    it('renders a class-based icon', async () => {
        const i = make('aux-icon', { icon: 'play' });
        await flush();
        assert.ok(i.shadowRoot!.querySelector('.icon.play'));
        assert.equal(i.getAttribute('role'), 'img');
    });
    it('renders a url-based icon as background-image', async () => {
        const i = make('aux-icon', { icon: './play.svg' });
        await flush();
        assert.match(i.shadowRoot!.innerHTML, /background-image: url/);
    });
});
