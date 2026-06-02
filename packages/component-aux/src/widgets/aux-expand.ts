/**
 * A collapsible section with a clickable header.
 *
 * Clean-room reimplementation of AUX's `Expand` (original code, MIT). The header
 * shows a label and an indicator; clicking (or Enter/Space) toggles the content,
 * which is projected through a `<slot>`.
 *
 * @demo
 * ```html
 * <aux-expand label="Advanced"><p>hidden settings</p></aux-expand>
 * ```
 *
 * @remarks
 * Attributes: `expanded`, `label`, `always-expanded`. Emits `expand`/`collapse`.
 */
import { WidgetBase } from '../core/widget-base.js';

export class AuxExpand extends WidgetBase {
    static get observedAttributes(): string[] {
        return ['expanded', 'label', 'always-expanded'];
    }

    get expanded(): boolean {
        return this.hasAttribute('expanded') || this.hasAttribute('always-expanded');
    }
    set expanded(v: boolean) {
        if (v) this.setAttribute('expanded', '');
        else this.removeAttribute('expanded');
    }

    get label(): string {
        return this.getAttribute('label') ?? '';
    }
    set label(v: string) {
        this.setAttribute('label', v);
    }

    private boundHeader = (ev: Event) => {
        if (ev instanceof KeyboardEvent && ev.key !== 'Enter' && ev.key !== ' ') return;
        if (ev instanceof KeyboardEvent) ev.preventDefault();
        this.toggle();
    };

    attributeChangedCallback(): void {
        this.requestUpdate();
    }

    toggle(): void {
        if (this.hasAttribute('always-expanded')) return;
        const next = !this.expanded;
        this.expanded = next;
        this.emit(next ? 'expand' : 'collapse');
    }

    protected render(): void {
        const expanded = this.expanded;
        this.root.innerHTML = `
            <style>
                :host { display: block; }
                .header {
                    display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;
                    padding: 6px 8px; background: var(--aux-button-bg, #2a2a2a); color: var(--aux-fg, #eee);
                    border-radius: 4px; outline: none;
                }
                .header:focus-visible { box-shadow: 0 0 0 2px var(--aux-accent, #3b82f6); }
                .arrow { transition: transform 0.15s ease; }
                .content { padding: 8px; display: ${expanded ? 'block' : 'none'}; }
            </style>
            <div class="header" part="header" role="button" tabindex="0" aria-expanded="${expanded}">
                <span class="arrow" part="arrow" style="transform: rotate(${expanded ? 90 : 0}deg)">▸</span>
                <span class="label" part="label">${escapeText(this.label)}</span>
            </div>
            <div class="content" part="content" role="region"><slot></slot></div>
        `;
        const header = this.root.querySelector('.header');
        header?.addEventListener('click', this.boundHeader);
        header?.addEventListener('keydown', this.boundHeader as EventListener);
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!customElements.get('aux-expand')) {
    customElements.define('aux-expand', AuxExpand);
}
