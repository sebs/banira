/**
 * A linear fader control.
 *
 * Clean-room reimplementation of AUX's `Fader` (original code, MIT). A draggable
 * handle on a track; orientation derives from `layout` (`left`/`right` →
 * vertical, `top`/`bottom` → horizontal). Pointer drag, wheel and keyboard
 * driven; accessible as an ARIA slider.
 *
 * @demo
 * ```html
 * <aux-fader value="0" min="-60" max="6" step="0.5" layout="left"></aux-fader>
 * ```
 *
 * @remarks
 * Attributes: `value`, `min`, `max`, `step`, `scale`, `layout`, `disabled`.
 */
import { ValueWidget } from '../core/value-widget.js';
import type { DragValueOptions } from '../core/drag-value.js';

export class AuxFader extends ValueWidget {
    static get observedAttributes(): string[] {
        return [...ValueWidget.observedAttributes, 'layout'];
    }

    get layout(): string {
        return this.getAttribute('layout') ?? 'left';
    }
    set layout(v: string) {
        this.setAttribute('layout', v);
    }

    private get vertical(): boolean {
        const l = this.layout;
        return l === 'left' || l === 'right';
    }

    attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
        if (name === 'layout') {
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
        // Handle position: 0 coef = low end. Vertical low end is the bottom.
        const pos = (vertical ? 1 - coef : coef) * 100;
        const handleStyle = vertical
            ? `left: 0; right: 0; top: ${pos}%; transform: translateY(-50%);`
            : `top: 0; bottom: 0; left: ${pos}%; transform: translateX(-50%);`;
        const fillStyle = vertical
            ? `left: 0; right: 0; bottom: 0; top: ${coef > 0 ? 100 - coef * 100 : 100}%;`
            : `top: 0; bottom: 0; left: 0; width: ${coef * 100}%;`;

        this.root.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    box-sizing: border-box;
                    width: var(--aux-fader-width, ${vertical ? '32px' : '200px'});
                    height: var(--aux-fader-height, ${vertical ? '200px' : '32px'});
                    outline: none;
                    touch-action: none;
                }
                :host([disabled]) { opacity: 0.5; pointer-events: none; }
                .track {
                    position: relative;
                    width: 100%; height: 100%;
                    background: var(--aux-track, #333);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .fill { position: absolute; background: var(--aux-accent, #3b82f6); }
                .handle {
                    position: absolute;
                    background: var(--aux-hand, #eee);
                    border-radius: 3px;
                    ${vertical ? 'height: 10px;' : 'width: 10px;'}
                }
                :host(:focus-visible) .handle { box-shadow: 0 0 0 2px var(--aux-accent, #3b82f6); }
            </style>
            <div class="track" part="track">
                <div class="fill" part="value" style="${fillStyle}"></div>
                <div class="handle" part="handle" style="${handleStyle}"></div>
            </div>
        `;
    }
}

if (!customElements.get('aux-fader')) {
    customElements.define('aux-fader', AuxFader);
}
