/**
 * An editable numeric/text value field.
 *
 * Clean-room reimplementation of AUX's `Value` (original code, MIT). Wraps an
 * `<input>`; commits on Enter (default) or on every keystroke (`editmode="immediate"`),
 * reverts on Escape, and selects its contents on focus.
 *
 * @demo
 * ```html
 * <aux-value value="0" min="-60" max="6"></aux-value>
 * ```
 *
 * @remarks
 * Attributes: `value`, `editmode` (onenter/immediate), `readonly`, `placeholder`,
 * `size`, `type`. Emits `input` while typing (immediate) and `change` on commit.
 */
import { WidgetBase } from '../core/widget-base.js';

export class AuxValue extends WidgetBase {
    private input: HTMLInputElement | null = null;
    private _value: number | string = 0;
    private committed = '';

    /** Formats the stored value for display. */
    format: (v: number | string) => string = (v) => String(v);
    /** Parses user input back to a stored value (`false`-y result is ignored). */
    parse: (raw: string) => number | string = (raw) => {
        const n = parseFloat(raw);
        return Number.isNaN(n) ? raw : n;
    };

    static get observedAttributes(): string[] {
        return ['value', 'placeholder', 'readonly', 'type', 'size'];
    }

    get value(): number | string {
        return this._value;
    }
    set value(v: number | string) {
        this._value = v;
        if (this.getAttribute('value') !== String(v)) this.setAttribute('value', String(v));
        if (this.input && this.input !== this.activeElement()) {
            this.input.value = this.format(v);
        }
    }

    private activeElement(): Element | null {
        return this.root?.activeElement ?? null;
    }

    private get editmode(): string {
        return this.getAttribute('editmode') ?? 'onenter';
    }

    connectedCallback(): void {
        const raw = this.getAttribute('value');
        if (raw !== null) this._value = this.parse(raw);
        super.connectedCallback();
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
        if (name === 'value' && value !== null) {
            this.value = this.parse(value);
        } else {
            this.requestUpdate();
        }
    }

    protected render(): void {
        if (!this.input) {
            this.root.innerHTML = `
                <style>
                    :host { display: inline-block; }
                    input {
                        width: var(--aux-value-width, auto);
                        font: var(--aux-font, inherit);
                        color: var(--aux-fg, inherit);
                        background: var(--aux-value-bg, #1e1e1e);
                        border: 1px solid var(--aux-track, #444);
                        border-radius: 3px;
                        padding: 2px 4px;
                        text-align: right;
                    }
                    input:focus { outline: 1px solid var(--aux-accent, #3b82f6); }
                </style>
                <input part="input" />
            `;
            this.input = this.root.querySelector('input');
            this.wire();
        }
        const input = this.input!;
        input.value = this.format(this._value);
        input.placeholder = this.getAttribute('placeholder') ?? '';
        input.readOnly = this.hasAttribute('readonly');
        input.type = this.getAttribute('type') ?? 'text';
        const size = this.getAttribute('size');
        if (size) input.size = parseInt(size, 10);
    }

    private wire(): void {
        const input = this.input!;
        input.addEventListener('focus', () => {
            this.committed = input.value;
            input.select();
        });
        input.addEventListener('input', () => {
            if (this.editmode === 'immediate') this.commit(false);
        });
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                this.commit(true);
                input.blur();
            } else if (ev.key === 'Escape') {
                input.value = this.committed;
                input.blur();
                this.emit('valueescape');
            }
        });
        input.addEventListener('blur', () => this.commit(true));
    }

    private commit(final: boolean): void {
        const input = this.input!;
        if (input.readOnly) return;
        const parsed = this.parse(input.value);
        const changed = parsed !== this._value;
        this._value = parsed;
        if (this.getAttribute('value') !== String(parsed)) {
            this.setAttribute('value', String(parsed));
        }
        if (changed) this.emit('input', { value: parsed });
        if (final && changed) this.emit('change', { value: parsed });
    }
}

if (!customElements.get('aux-value')) {
    customElements.define('aux-value', AuxValue);
}
