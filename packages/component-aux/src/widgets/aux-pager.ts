/**
 * A tabbed pager — {@link AuxPages} plus a navigation bar of tab buttons.
 *
 * Clean-room reimplementation of AUX's `Pager` (original code, MIT). Each page's
 * tab label comes from its `title` (or `data-title`) attribute.
 *
 * @demo
 * ```html
 * <aux-pager show="0">
 *   <div title="Mix">…</div>
 *   <div title="FX">…</div>
 * </aux-pager>
 * ```
 *
 * @remarks
 * Attributes: `show` (page index), `position` (top/bottom/left/right). Clicking a
 * tab (or arrow keys on the tab bar) switches pages; emits `changed`.
 */
import { AuxPages } from './aux-pages.js';

export class AuxPager extends AuxPages {
    static get observedAttributes(): string[] {
        return [...AuxPages.observedAttributes, 'position'];
    }

    private onTabClick = (ev: Event): void => {
        const path = ev.composedPath();
        const btn = path.find(
            (n): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute('data-page')
        );
        if (btn) this.showPage(parseInt(btn.getAttribute('data-page')!, 10));
    };

    private onTabKey = (ev: KeyboardEvent): void => {
        const n = this.pages.length;
        if (n === 0) return;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
            ev.preventDefault();
            this.showPage((this.show + 1) % n);
        } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            this.showPage((this.show - 1 + n) % n);
        }
    };

    protected render(): void {
        const active = this.show;
        const position = this.getAttribute('position') ?? 'top';
        const vertical = position === 'left' || position === 'right';
        const tabs = this.pages
            .map((page, i) => {
                const title = page.getAttribute('title') ?? page.getAttribute('data-title') ?? `Page ${i + 1}`;
                return `<button role="tab" data-page="${i}" tabindex="${i === active ? 0 : -1}"
                                aria-selected="${i === active}"
                                class="${i === active ? 'active' : ''}">${escapeText(title)}</button>`;
            })
            .join('');

        this.root.innerHTML = `
            <style>
                :host { display: flex; flex-direction: ${vertical ? 'row' : 'column'}; }
                :host([position="bottom"]) { flex-direction: column-reverse; }
                :host([position="right"]) { flex-direction: row-reverse; }
                .tabs { display: flex; flex-direction: ${vertical ? 'column' : 'row'}; gap: 2px; }
                button {
                    padding: 6px 12px; cursor: pointer; border: none;
                    background: var(--aux-button-bg, #2a2a2a); color: var(--aux-fg, #ccc);
                    font: var(--aux-font, inherit); border-radius: 4px;
                }
                button.active { background: var(--aux-accent, #3b82f6); color: #fff; }
                button:focus-visible { outline: 2px solid var(--aux-accent, #3b82f6); }
                .content { flex: 1; padding: 8px; }
            </style>
            <div class="tabs" part="tabs" role="tablist">${tabs}</div>
            <div class="content" part="content"><slot></slot></div>
        `;
        const tabBar = this.root.querySelector('.tabs');
        tabBar?.addEventListener('click', this.onTabClick);
        tabBar?.addEventListener('keydown', this.onTabKey as EventListener);
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!customElements.get('aux-pager')) {
    customElements.define('aux-pager', AuxPager);
}
