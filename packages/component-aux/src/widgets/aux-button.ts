/**
 * A button with optional label and icon.
 *
 * Clean-room reimplementation of AUX's `Button` (original code, MIT). Activates
 * on click and on Enter/Space for keyboard users; emits `clicked`. Subclassed by
 * {@link AuxToggle}.
 *
 * @demo
 * ```html
 * <aux-button label="Play" icon="play"></aux-button>
 * ```
 *
 * @remarks
 * Attributes: `label`, `icon`, `state`, `layout` (horizontal/vertical), `disabled`.
 */
import { WidgetBase } from '../core/widget-base.js';

export class AuxButton extends WidgetBase {
    static get observedAttributes(): string[] {
        return ['label', 'icon', 'state', 'layout', 'disabled'];
    }

    get label(): string {
        return this.getAttribute('label') ?? '';
    }
    set label(v: string) {
        this.setAttribute('label', v);
    }

    get icon(): string {
        return this.getAttribute('icon') ?? '';
    }
    set icon(v: string) {
        this.setAttribute('icon', v);
    }

    get state(): boolean {
        return this.boolAttr('state');
    }
    set state(v: boolean) {
        if (v) this.setAttribute('state', '');
        else this.removeAttribute('state');
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled');
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '');
        else this.removeAttribute('disabled');
    }

    private boundClick = () => this.handleActivate();
    private boundKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            this.handleActivate();
        }
    };

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
        super.connectedCallback();
        this.addEventListener('click', this.boundClick);
        this.addEventListener('keydown', this.boundKey);
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.boundClick);
        this.removeEventListener('keydown', this.boundKey);
    }

    attributeChangedCallback(): void {
        this.requestUpdate();
    }

    private handleActivate(): void {
        if (this.disabled) return;
        this.activate();
        this.emit('clicked');
    }

    /** Activation hook; {@link AuxToggle} overrides this to flip state. */
    protected activate(): void {
        this.emit('pressed');
    }

    protected render(): void {
        const layout = this.getAttribute('layout') ?? 'horizontal';
        const iconHtml = this.icon
            ? `<span class="icon ${escapeAttr(this.icon)}" part="icon"></span>`
            : '';
        const labelHtml = this.label ? `<span class="label" part="label">${escapeText(this.label)}</span>` : '';

        this.root.innerHTML = `
            <style>
                :host {
                    display: inline-flex;
                    align-items: center; justify-content: center;
                    gap: 6px;
                    padding: var(--aux-button-pad, 6px 12px);
                    background: var(--aux-button-bg, #2a2a2a);
                    color: var(--aux-fg, #eee);
                    border-radius: 4px;
                    cursor: pointer; user-select: none; outline: none;
                    font: var(--aux-font, inherit);
                }
                :host([layout="vertical"]) { flex-direction: column; }
                :host([state]) { background: var(--aux-accent, #3b82f6); color: #fff; }
                :host([disabled]) { opacity: 0.5; pointer-events: none; }
                :host(:focus-visible) { box-shadow: 0 0 0 2px var(--aux-accent, #3b82f6); }
                .icon { width: 1em; height: 1em; background-size: contain; background-repeat: no-repeat; }
            </style>
            <div class="content" part="content" data-layout="${escapeAttr(layout)}">
                ${iconHtml}${labelHtml}
            </div>
        `;
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(value: string): string {
    return escapeText(value).replace(/"/g, '&quot;');
}

if (!customElements.get('aux-button')) {
    customElements.define('aux-button', AuxButton);
}
