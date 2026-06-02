import './setup.js';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { flush } from './setup.js';
import '../src/index.js';

afterEach(() => {
    document.body.innerHTML = '';
});

describe('aux-container', () => {
    it('toggles visibility and emits events', () => {
        const c = document.createElement('aux-container') as HTMLElement & {
            visible: boolean;
            hide(): void;
            show(): void;
        };
        document.body.appendChild(c);
        let shown = 0;
        let hidden = 0;
        c.addEventListener('show', () => shown++);
        c.addEventListener('hide', () => hidden++);
        assert.equal(c.visible, true);
        c.hide();
        assert.equal(c.visible, false);
        assert.equal(c.hasAttribute('hidden'), true);
        assert.equal(hidden, 1);
        c.show();
        assert.equal(c.visible, true);
        assert.equal(shown, 1);
    });
});

describe('aux-expand', () => {
    it('expands and collapses on header click', async () => {
        const e = document.createElement('aux-expand') as HTMLElement & { expanded: boolean };
        e.setAttribute('label', 'More');
        e.innerHTML = '<p>body</p>';
        document.body.appendChild(e);
        let expand = 0;
        let collapse = 0;
        e.addEventListener('expand', () => expand++);
        e.addEventListener('collapse', () => collapse++);
        await flush();
        const header = e.shadowRoot!.querySelector('.header') as HTMLElement;
        header.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        assert.equal(e.expanded, true);
        assert.equal(expand, 1);
        await flush();
        const header2 = e.shadowRoot!.querySelector('.header') as HTMLElement;
        assert.equal(header2.getAttribute('aria-expanded'), 'true');
        header2.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        assert.equal(e.expanded, false);
        assert.equal(collapse, 1);
    });

    it('always-expanded cannot collapse', () => {
        const e = document.createElement('aux-expand') as HTMLElement & { expanded: boolean; toggle(): void };
        e.setAttribute('always-expanded', '');
        document.body.appendChild(e);
        e.toggle();
        assert.equal(e.expanded, true);
    });
});

describe('aux-pages', () => {
    it('shows only the active child', () => {
        const p = document.createElement('aux-pages') as HTMLElement & { show: number; showPage(i: number): void };
        const a = document.createElement('div');
        const b = document.createElement('div');
        const c = document.createElement('div');
        p.append(a, b, c);
        p.setAttribute('show', '1');
        document.body.appendChild(p);
        assert.equal(a.hidden, true);
        assert.equal(b.hidden, false);
        assert.equal(c.hidden, true);
        let changed = -1;
        p.addEventListener('changed', (e) => (changed = (e as CustomEvent).detail.index));
        p.showPage(2);
        assert.equal(b.hidden, true);
        assert.equal(c.hidden, false);
        assert.equal(changed, 2);
    });
});

describe('aux-pager', () => {
    it('builds tabs from child titles and switches on click', async () => {
        const p = document.createElement('aux-pager') as HTMLElement & { show: number };
        const a = document.createElement('div'); a.setAttribute('title', 'Mix');
        const b = document.createElement('div'); b.setAttribute('title', 'FX');
        p.append(a, b);
        document.body.appendChild(p);
        await flush();
        const buttons = p.shadowRoot!.querySelectorAll('button');
        assert.equal(buttons.length, 2);
        assert.match(buttons[0].textContent!, /Mix/);
        assert.match(buttons[1].textContent!, /FX/);
        assert.equal(a.hidden, false);
        assert.equal(b.hidden, true);
        (p.shadowRoot!.querySelector('[data-page="1"]') as HTMLElement).dispatchEvent(
            new MouseEvent('click', { bubbles: true, composed: true })
        );
        assert.equal(p.show, 1);
        assert.equal(a.hidden, true);
        assert.equal(b.hidden, false);
    });
});
