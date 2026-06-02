/**
 * A single-selection dropdown.
 *
 * Clean-room reimplementation of AUX's `Select` (original code, MIT). Shows the
 * selected entry's label and reveals a list on click; keyboard accessible
 * (arrows / Enter / Escape / type-ahead).
 *
 * @demo
 * ```html
 * <aux-select placeholder="Choose…"></aux-select>
 * ```
 *
 * @remarks
 * Set `entries` (property) to an array of strings or `{ label, value }`. Emits
 * `select` with `{ value, index, label, entry }` and `change`.
 */
import { WidgetBase } from '../core/widget-base.js';

export interface SelectEntry {
    label: string;
    value: unknown;
}

export class AuxSelect extends WidgetBase {
    private _entries: SelectEntry[] = [];
    private _selected = -1;
    private _open = false;
    private highlight = -1;
    private typeBuffer = '';
    private typeTimer: ReturnType<typeof setTimeout> | null = null;

    static get observedAttributes(): string[] {
        return ['placeholder', 'disabled'];
    }

    /** The list of selectable entries (strings or `{ label, value }`). */
    get entries(): SelectEntry[] {
        return this._entries;
    }
    set entries(list: Array<string | SelectEntry>) {
        this._entries = list.map((e) =>
            typeof e === 'string' ? { label: e, value: e } : { label: e.label, value: e.value }
        );
        if (this._selected >= this._entries.length) this._selected = -1;
        this.requestUpdate();
    }

    get selected(): number {
        return this._selected;
    }
    set selected(index: number) {
        this.selectIndex(index, false);
    }

    get value(): unknown {
        return this._selected >= 0 ? this._entries[this._selected].value : undefined;
    }
    set value(v: unknown) {
        const idx = this._entries.findIndex((e) => e.value === v);
        if (idx >= 0) this.selectIndex(idx, false);
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled');
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'listbox');
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
        this.setAttribute('aria-expanded', 'false');
        super.connectedCallback();
        this.addEventListener('click', this.onClick);
        this.addEventListener('keydown', this.onKey);
        this.outsideHandler = (ev: Event) => {
            if (this._open && !ev.composedPath().includes(this)) this.close();
        };
        document.addEventListener('pointerdown', this.outsideHandler);
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('keydown', this.onKey);
        if (this.outsideHandler) document.removeEventListener('pointerdown', this.outsideHandler);
        if (this.typeTimer) clearTimeout(this.typeTimer);
    }

    attributeChangedCallback(): void {
        this.requestUpdate();
    }

    private outsideHandler: ((ev: Event) => void) | null = null;

    private onClick = (ev: Event): void => {
        if (this.disabled) return;
        const path = ev.composedPath();
        const entryEl = path.find(
            (n): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute('data-index')
        );
        if (entryEl) {
            this.selectIndex(parseInt(entryEl.getAttribute('data-index')!, 10), true);
            this.close();
        } else {
            this.toggle();
        }
    };

    private onKey = (ev: KeyboardEvent): void => {
        if (this.disabled) return;
        switch (ev.key) {
            case 'ArrowDown':
                ev.preventDefault();
                if (!this._open) this.open();
                else this.move(1);
                break;
            case 'ArrowUp':
                ev.preventDefault();
                this.move(-1);
                break;
            case 'Enter':
            case ' ':
                ev.preventDefault();
                if (this._open && this.highlight >= 0) {
                    this.selectIndex(this.highlight, true);
                    this.close();
                } else {
                    this.toggle();
                }
                break;
            case 'Escape':
                this.close();
                break;
            default:
                if (ev.key.length === 1) this.typeAhead(ev.key);
        }
    };

    private typeAhead(ch: string): void {
        this.typeBuffer += ch.toLowerCase();
        if (this.typeTimer) clearTimeout(this.typeTimer);
        this.typeTimer = setTimeout(() => (this.typeBuffer = ''), 250);
        const idx = this._entries.findIndex((e) => e.label.toLowerCase().startsWith(this.typeBuffer));
        if (idx >= 0) {
            this.highlight = idx;
            if (!this._open) this.selectIndex(idx, true);
            else this.requestUpdate();
        }
    }

    private move(delta: number): void {
        if (this._entries.length === 0) return;
        const n = this._entries.length;
        this.highlight = (((this.highlight < 0 ? this._selected : this.highlight) + delta) % n + n) % n;
        this.requestUpdate();
    }

    private selectIndex(index: number, fromUser: boolean): void {
        if (index < 0 || index >= this._entries.length || index === this._selected) {
            if (index === this._selected) return;
        }
        this._selected = index;
        this.highlight = index;
        this.setAttribute('aria-activedescendant', `aux-opt-${index}`);
        this.requestUpdate();
        if (fromUser) {
            const entry = this._entries[index];
            this.emit('select', { value: entry?.value, index, label: entry?.label, entry });
            this.emit('change', { value: entry?.value });
        }
    }

    private open(): void {
        if (this._open || this.disabled) return;
        this._open = true;
        this.highlight = this._selected;
        this.setAttribute('aria-expanded', 'true');
        this.requestUpdate();
    }
    private close(): void {
        if (!this._open) return;
        this._open = false;
        this.setAttribute('aria-expanded', 'false');
        this.requestUpdate();
    }
    private toggle(): void {
        if (this._open) this.close();
        else this.open();
    }

    protected render(): void {
        const label = this._selected >= 0 ? this._entries[this._selected].label : (this.getAttribute('placeholder') ?? '');
        const items = this._entries
            .map(
                (e, i) =>
                    `<li id="aux-opt-${i}" role="option" data-index="${i}"
                         class="${i === this._selected ? 'selected' : ''} ${i === this.highlight ? 'highlight' : ''}"
                         aria-selected="${i === this._selected}">${escapeText(e.label)}</li>`
            )
            .join('');

        this.root.innerHTML = `
            <style>
                :host { display: inline-block; position: relative; outline: none; font: var(--aux-font, 13px sans-serif); }
                :host([disabled]) { opacity: 0.5; pointer-events: none; }
                .button {
                    display: flex; align-items: center; gap: 8px; justify-content: space-between;
                    padding: 6px 10px; min-width: 120px; cursor: pointer;
                    background: var(--aux-button-bg, #2a2a2a); color: var(--aux-fg, #eee); border-radius: 4px;
                }
                .arrow { opacity: 0.6; }
                ul {
                    list-style: none; margin: 4px 0 0; padding: 4px;
                    position: absolute; left: 0; right: 0; z-index: 10;
                    background: var(--aux-list-bg, #1e1e1e); border: 1px solid var(--aux-track, #444); border-radius: 4px;
                    max-height: 240px; overflow: auto;
                    display: ${this._open ? 'block' : 'none'};
                }
                li { padding: 5px 8px; border-radius: 3px; cursor: pointer; }
                li.highlight { background: var(--aux-track, #3a3a3a); }
                li.selected { color: var(--aux-accent, #3b82f6); }
                :host(:focus-visible) .button { box-shadow: 0 0 0 2px var(--aux-accent, #3b82f6); }
            </style>
            <div class="button" part="button">
                <span class="label" part="label">${escapeText(label)}</span>
                <span class="arrow" part="arrow">▾</span>
            </div>
            <ul part="list">${items}</ul>
        `;
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!customElements.get('aux-select')) {
    customElements.define('aux-select', AuxSelect);
}
