import './setup.js';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { flush } from './setup.js';
import '../src/index.js';
import type { AuxSelect } from '../src/widgets/aux-select.js';
import type { AuxComboBox } from '../src/widgets/aux-combobox.js';
import type { AuxLevelMeter } from '../src/widgets/aux-levelmeter.js';

function make(tag: string, attrs: Record<string, string | number> = {}): HTMLElement {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    document.body.appendChild(el);
    return el;
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('aux-meter', () => {
    it('clamps value and exposes meter ARIA', () => {
        const m = make('aux-meter', { min: -60, max: 0, value: 10 }) as HTMLElement & { value: number };
        assert.equal(m.value, 0);
        assert.equal(m.getAttribute('role'), 'meter');
        assert.equal(m.getAttribute('aria-valuemin'), '-60');
    });
    it('fills between base and value', async () => {
        const m = make('aux-meter', { min: 0, max: 1, base: 0, value: 0.5, layout: 'top' });
        await flush();
        const fill = m.shadowRoot!.querySelector('.fill') as HTMLElement;
        assert.match(fill.getAttribute('style')!, /width: 50%/);
    });
});

describe('aux-levelmeter', () => {
    it('tracks the peak with hold', () => {
        const m = make('aux-levelmeter', { min: -60, max: 0, value: -40 }) as unknown as AuxLevelMeter;
        m.value = -10;
        m.value = -20;
        assert.equal(m.top, -10, 'peak holds the maximum');
    });
    it('resetTop clears the hold to the current value', () => {
        const m = make('aux-levelmeter', { min: -60, max: 0, value: -40 }) as unknown as AuxLevelMeter;
        m.value = -5;
        m.value = -30;
        m.resetTop();
        assert.equal(m.top, -30);
    });
    it('lights and latches clip above the threshold', () => {
        const m = make('aux-levelmeter', {
            min: -60,
            max: 0,
            value: -40,
            clipping: '-3',
            'auto-clip': '-1',
        }) as unknown as AuxLevelMeter;
        m.value = -1;
        assert.equal(m.clip, true);
        assert.equal((m as unknown as HTMLElement).hasAttribute('clip'), true);
        m.resetClip();
        assert.equal(m.clip, false);
    });
});

describe('aux-select', () => {
    it('selects by value and emits select on user click', async () => {
        const s = make('aux-select') as unknown as AuxSelect;
        s.entries = ['Sine', 'Square', { label: 'Saw', value: 'sawtooth' }];
        let detail: { value?: unknown; index?: number } = {};
        const el = s as unknown as HTMLElement;
        el.addEventListener('select', (e) => {
            detail = (e as CustomEvent).detail;
        });
        s.value = 'sawtooth';
        assert.equal(s.selected, 2);
        assert.equal(s.value, 'sawtooth');

        el.click(); // open the list
        await flush();
        const li = el.shadowRoot!.querySelector('[data-index="1"]') as HTMLElement;
        assert.ok(li, 'options are rendered');
        li.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        assert.equal(detail.index, 1);
        assert.equal(detail.value, 'Square');
    });

    it('opens and closes via aria-expanded', () => {
        const s = make('aux-select') as unknown as AuxSelect;
        s.entries = ['a', 'b'];
        const el = s as unknown as HTMLElement;
        assert.equal(el.getAttribute('aria-expanded'), 'false');
        el.click();
        assert.equal(el.getAttribute('aria-expanded'), 'true');
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(el.getAttribute('aria-expanded'), 'false');
    });
});

describe('aux-combobox', () => {
    it('filters and selects an entry', async () => {
        const c = make('aux-combobox') as unknown as AuxComboBox;
        c.entries = ['Alpha', 'Beta', 'Gamma'];
        await flush();
        const el = c as unknown as HTMLElement;
        const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
        let selected: { value?: unknown } = {};
        el.addEventListener('select', (e) => {
            selected = (e as CustomEvent).detail;
        });
        input.value = 'be';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const li = el.shadowRoot!.querySelector('[data-index="1"]') as HTMLElement;
        assert.ok(li, 'Beta should be in the filtered list');
        // jsdom lacks PointerEvent; a MouseEvent of type 'pointerdown' triggers the listener.
        li.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        assert.equal(c.value, 'Beta');
        assert.equal(selected.value, 'Beta');
    });
});
