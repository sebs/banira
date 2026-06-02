/**
 * An editable combo box — a text field with a filtered dropdown of suggestions.
 *
 * Clean-room reimplementation of AUX's `ComboBox` (original code, MIT), which
 * pairs a Value (text input) with a Select. Typing filters the entries; choosing
 * one fills the field.
 *
 * @demo
 * ```html
 * <aux-combobox placeholder="Frequency…"></aux-combobox>
 * ```
 *
 * @remarks
 * Set `entries` (property) to strings or `{ label, value }`. Emits `select`
 * with `{ value, index, label, entry }`, plus `input`/`change`.
 */
import { WidgetBase } from '../core/widget-base.js';
import type { SelectEntry } from './aux-select.js';

export class AuxComboBox extends WidgetBase {
    private input: HTMLInputElement | null = null;
    private list: HTMLUListElement | null = null;
    private _entries: SelectEntry[] = [];
    private highlight = -1;
    private open = false;

    static get observedAttributes(): string[] {
        return ['placeholder', 'disabled'];
    }

    get entries(): SelectEntry[] {
        return this._entries;
    }
    set entries(list: Array<string | SelectEntry>) {
        this._entries = list.map((e) =>
            typeof e === 'string' ? { label: e, value: e } : { label: e.label, value: e.value }
        );
        this.updateList();
    }

    get value(): string {
        return this.input?.value ?? '';
    }
    set value(v: string) {
        if (this.input) this.input.value = v;
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'combobox');
        super.connectedCallback();
    }

    disconnectedCallback(): void {
        if (this.outsideHandler) document.removeEventListener('pointerdown', this.outsideHandler);
    }

    attributeChangedCallback(): void {
        if (this.input) this.input.placeholder = this.getAttribute('placeholder') ?? '';
    }

    private outsideHandler: ((ev: Event) => void) | null = null;

    private filtered(): Array<{ entry: SelectEntry; index: number }> {
        const q = (this.input?.value ?? '').toLowerCase();
        return this._entries
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => entry.label.toLowerCase().includes(q));
    }

    private updateList(): void {
        if (!this.list) return;
        const rows = this.filtered();
        this.list.innerHTML = rows
            .map(
                ({ entry, index }) =>
                    `<li role="option" data-index="${index}"
                         class="${index === this.highlight ? 'highlight' : ''}">${escapeText(entry.label)}</li>`
            )
            .join('');
        this.list.style.display = this.open && rows.length > 0 ? 'block' : 'none';
        this.setAttribute('aria-expanded', String(this.open && rows.length > 0));
    }

    private choose(index: number): void {
        const entry = this._entries[index];
        if (!entry) return;
        if (this.input) this.input.value = entry.label;
        this.open = false;
        this.updateList();
        this.emit('select', { value: entry.value, index, label: entry.label, entry });
        this.emit('change', { value: entry.value });
    }

    protected render(): void {
        if (this.input) return; // structure is static; only the list updates
        this.root.innerHTML = `
            <style>
                :host { display: inline-block; position: relative; font: var(--aux-font, 13px sans-serif); }
                :host([disabled]) { opacity: 0.5; pointer-events: none; }
                input {
                    box-sizing: border-box; padding: 6px 10px; min-width: 140px;
                    background: var(--aux-value-bg, #1e1e1e); color: var(--aux-fg, #eee);
                    border: 1px solid var(--aux-track, #444); border-radius: 4px;
                }
                input:focus { outline: 1px solid var(--aux-accent, #3b82f6); }
                ul {
                    list-style: none; margin: 4px 0 0; padding: 4px;
                    position: absolute; left: 0; right: 0; z-index: 10; display: none;
                    background: var(--aux-list-bg, #1e1e1e); border: 1px solid var(--aux-track, #444); border-radius: 4px;
                    max-height: 240px; overflow: auto;
                }
                li { padding: 5px 8px; border-radius: 3px; cursor: pointer; }
                li.highlight { background: var(--aux-track, #3a3a3a); }
            </style>
            <input part="input" />
            <ul part="list"></ul>
        `;
        this.input = this.root.querySelector('input');
        this.list = this.root.querySelector('ul');
        if (this.input) this.input.placeholder = this.getAttribute('placeholder') ?? '';
        this.wire();
        this.updateList();
    }

    private wire(): void {
        const input = this.input!;
        input.addEventListener('input', () => {
            this.open = true;
            this.highlight = -1;
            this.updateList();
            this.emit('input', { value: input.value });
        });
        input.addEventListener('focus', () => {
            this.open = true;
            this.updateList();
        });
        input.addEventListener('keydown', (ev) => {
            const rows = this.filtered();
            if (ev.key === 'ArrowDown') {
                ev.preventDefault();
                this.open = true;
                this.highlight = Math.min(rows.length - 1, this.highlight + 1);
                this.updateList();
            } else if (ev.key === 'ArrowUp') {
                ev.preventDefault();
                this.highlight = Math.max(0, this.highlight - 1);
                this.updateList();
            } else if (ev.key === 'Enter') {
                if (this.open && this.highlight >= 0 && rows[this.highlight]) {
                    this.choose(rows[this.highlight].index);
                } else {
                    this.emit('change', { value: input.value });
                }
            } else if (ev.key === 'Escape') {
                this.open = false;
                this.updateList();
            }
        });
        this.list!.addEventListener('pointerdown', (ev) => {
            const path = ev.composedPath();
            const li = path.find(
                (n): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute('data-index')
            );
            if (li) {
                ev.preventDefault();
                this.choose(parseInt(li.getAttribute('data-index')!, 10));
            }
        });
        this.outsideHandler = (ev: Event) => {
            if (this.open && !ev.composedPath().includes(this)) {
                this.open = false;
                this.updateList();
            }
        };
        document.addEventListener('pointerdown', this.outsideHandler);
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!customElements.get('aux-combobox')) {
    customElements.define('aux-combobox', AuxComboBox);
}
