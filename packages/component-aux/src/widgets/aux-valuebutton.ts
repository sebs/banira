/**
 * A value display that doubles as a control: drag / wheel / keyboard to adjust,
 * double-click to type an exact value.
 *
 * Clean-room reimplementation of AUX's `ValueButton` (original code, MIT).
 *
 * @demo
 * ```html
 * <aux-valuebutton value="0" min="-60" max="6" step="0.5"></aux-valuebutton>
 * ```
 *
 * @remarks
 * Attributes: `value`, `min`, `max`, `step`, `scale`, `disabled`. Emits `input`
 * while adjusting and `change` on commit; `valueedit`/`valueset` around inline
 * editing.
 */
import { ValueWidget } from '../core/value-widget.js';
import type { DragValueOptions } from '../core/drag-value.js';

export class AuxValueButton extends ValueWidget {
    /** Formats the displayed value. */
    format: (v: number) => string = (v) => v.toFixed(2);
    private editing = false;
    private boundDbl = () => this.beginEdit();

    protected dragOptions(): Partial<DragValueOptions> {
        return { direction: 'polar', rotation: 45, blind_angle: 20, basis: 300 };
    }

    protected blockUserInput(): boolean {
        return this.editing;
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener('dblclick', this.boundDbl);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('dblclick', this.boundDbl);
    }

    private beginEdit(): void {
        if (this.disabled || this.editing) return;
        this.editing = true;
        this.emit('valueedit');
        this.requestUpdate();
    }

    private commitEdit(raw: string): void {
        const parsed = parseFloat(raw);
        this.editing = false;
        if (!Number.isNaN(parsed)) {
            const next = this.range.snap(parsed);
            if (next !== this.value) {
                this.value = next;
                this.emit('input', { value: this.value });
            }
            this.emit('valueset', { value: this.value });
            this.emit('change', { value: this.value });
        }
        this.requestUpdate();
    }

    protected renderControl(): void {
        const coef = this.coef();
        if (this.editing) {
            this.root.innerHTML = `
                <style>${this.styles()}</style>
                <div class="box" part="content">
                    <input part="input" value="${this.value}" />
                </div>
            `;
            const input = this.root.querySelector('input');
            if (input) {
                input.focus();
                input.select();
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') this.commitEdit(input.value);
                    else if (ev.key === 'Escape') {
                        this.editing = false;
                        this.requestUpdate();
                    }
                });
                input.addEventListener('blur', () => {
                    if (this.editing) this.commitEdit(input.value);
                });
            }
            return;
        }

        this.root.innerHTML = `
            <style>${this.styles()}</style>
            <div class="box" part="content">
                <span class="value" part="label">${escapeText(this.format(this.value))}</span>
                <div class="fill" part="value" style="width:${coef * 100}%"></div>
            </div>
        `;
    }

    private styles(): string {
        return `
            :host {
                display: inline-block; min-width: 64px;
                outline: none; user-select: none; touch-action: none; cursor: ns-resize;
            }
            :host([disabled]) { opacity: 0.5; pointer-events: none; }
            .box {
                position: relative; overflow: hidden;
                padding: 4px 8px; text-align: center;
                background: var(--aux-button-bg, #2a2a2a); color: var(--aux-fg, #eee);
                border-radius: 4px; font: var(--aux-font, 13px monospace);
            }
            .fill { position: absolute; left: 0; bottom: 0; height: 3px; background: var(--aux-accent, #3b82f6); }
            input {
                width: 100%; box-sizing: border-box; text-align: center;
                font: inherit; color: inherit; background: transparent; border: none; outline: none;
            }
            :host(:focus-visible) .box { box-shadow: 0 0 0 2px var(--aux-accent, #3b82f6); }
        `;
    }
}

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!customElements.get('aux-valuebutton')) {
    customElements.define('aux-valuebutton', AuxValueButton);
}
