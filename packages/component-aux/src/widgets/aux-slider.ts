/**
 * A linear slider control.
 *
 * Clean-room reimplementation of AUX's `Slider` (original code, MIT). Similar to
 * {@link AuxFader} but with a simpler thumb-on-rail visual and an `alignment`
 * (`horizontal`/`vertical`) instead of a layout side.
 *
 * @demo
 * ```html
 * <aux-slider value="50" min="0" max="100" alignment="horizontal"></aux-slider>
 * ```
 *
 * @remarks
 * Attributes: `value`, `min`, `max`, `step`, `scale`, `alignment`, `disabled`.
 */
import { ValueWidget } from '../core/value-widget.js';
import type { DragValueOptions } from '../core/drag-value.js';

export class AuxSlider extends ValueWidget {
    static get observedAttributes(): string[] {
        return [...ValueWidget.observedAttributes, 'alignment'];
    }

    get alignment(): string {
        return this.getAttribute('alignment') ?? 'horizontal';
    }
    set alignment(v: string) {
        this.setAttribute('alignment', v);
    }

    private get vertical(): boolean {
        return this.alignment === 'vertical';
    }

    attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
        if (name === 'alignment') {
            this.setAttribute('aria-orientation', this.vertical ? 'vertical' : 'horizontal');
            this.requestUpdate();
            return;
        }
        super.attributeChangedCallback(name, oldValue, value);
    }

    protected dragOptions(): Partial<DragValueOptions> {
        return { direction: this.vertical ? 'vertical' : 'horizontal', basis: 200 };
    }

    protected renderControl(): void {
        const coef = this.coef();
        const vertical = this.vertical;
        const pos = (vertical ? 1 - coef : coef) * 100;
        const thumbStyle = vertical
            ? `left: 50%; top: ${pos}%; transform: translate(-50%, -50%);`
            : `top: 50%; left: ${pos}%; transform: translate(-50%, -50%);`;

        this.root.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    width: var(--aux-slider-width, ${vertical ? '24px' : '160px'});
                    height: var(--aux-slider-height, ${vertical ? '160px' : '24px'});
                    outline: none;
                    touch-action: none;
                }
                :host([disabled]) { opacity: 0.5; pointer-events: none; }
                .rail {
                    position: relative;
                    width: 100%; height: 100%;
                }
                .rail::before {
                    content: '';
                    position: absolute;
                    background: var(--aux-track, #555);
                    border-radius: 999px;
                    ${vertical
                        ? 'left: 50%; top: 0; bottom: 0; width: 4px; transform: translateX(-50%);'
                        : 'top: 50%; left: 0; right: 0; height: 4px; transform: translateY(-50%);'}
                }
                .thumb {
                    position: absolute;
                    width: 16px; height: 16px;
                    background: var(--aux-accent, #3b82f6);
                    border-radius: 50%;
                }
                :host(:focus-visible) .thumb { box-shadow: 0 0 0 3px var(--aux-accent, #3b82f6); }
            </style>
            <div class="rail" part="track">
                <div class="thumb" part="handle" style="${thumbStyle}"></div>
            </div>
        `;
    }
}

if (!customElements.get('aux-slider')) {
    customElements.define('aux-slider', AuxSlider);
}
