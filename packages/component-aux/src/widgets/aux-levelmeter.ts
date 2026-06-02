/**
 * A level meter with peak-hold, clip indication and optional falloff.
 *
 * Clean-room reimplementation of AUX's `LevelMeter` (original code, MIT),
 * extending {@link AuxMeter}.
 *
 * @demo
 * ```html
 * <aux-levelmeter value="-18" min="-60" max="0" show-hold clipping="-3"></aux-levelmeter>
 * ```
 *
 * @remarks
 * Attributes: all of {@link AuxMeter} plus `show-hold`, `clipping`,
 * `auto-clip` (ms; -1 = latch), `falling`, `falling-duration`. Peak-hold tracks
 * the maximum value seen; call {@link resetTop} / {@link resetClip} to clear.
 */
import { AuxMeter } from './aux-meter.js';

export class AuxLevelMeter extends AuxMeter {
    private _top = -Infinity;
    private _clip = false;
    private clipTimer: ReturnType<typeof setTimeout> | null = null;
    private fallingRaf = 0;

    static get observedAttributes(): string[] {
        return [...AuxMeter.observedAttributes, 'show-hold', 'clipping', 'auto-clip', 'falling', 'falling-duration'];
    }

    connectedCallback(): void {
        super.connectedCallback();
        // Reset the peak to the connected value: option setters (min/max) fire
        // onValueChanged with the placeholder 0 during attribute parsing, which
        // would otherwise seed the hold incorrectly.
        this._top = this.value;
    }

    /** The current peak-hold value. */
    get top(): number {
        return this._top === -Infinity ? this.value : this._top;
    }

    /** Whether the clip indicator is currently lit. */
    get clip(): boolean {
        return this._clip;
    }

    protected override onValueChanged(v: number): void {
        if (v > this._top || this._top === -Infinity) {
            this._top = v;
        }
        const clippingAttr = this.getAttribute('clipping');
        if (clippingAttr !== null) {
            const threshold = parseFloat(clippingAttr);
            if (!Number.isNaN(threshold) && v >= threshold) this.triggerClip();
        }
        this.maybeStartFalling();
    }

    /** Resets the peak-hold marker to the current value. */
    resetTop(): void {
        this._top = this.value;
        this.emit('resettop');
        this.requestUpdate();
    }

    /** Clears the clip indicator. */
    resetClip(): void {
        this._clip = false;
        this.removeAttribute('clip');
        this.emit('resetclip');
        this.requestUpdate();
    }

    private triggerClip(): void {
        this._clip = true;
        this.setAttribute('clip', '');
        if (this.clipTimer) clearTimeout(this.clipTimer);
        const auto = this.getAttribute('auto-clip');
        const ms = auto !== null ? parseInt(auto, 10) : -1;
        if (ms >= 0) {
            this.clipTimer = setTimeout(() => this.resetClip(), ms);
        }
    }

    private maybeStartFalling(): void {
        const falling = this.numAttr('falling', 0);
        if (falling <= 0 || this.fallingRaf || typeof requestAnimationFrame !== 'function') return;
        const tick = () => {
            // Decay the peak-hold marker toward the live value.
            if (this._top > this.value) {
                this._top = Math.max(this.value, this._top - falling);
                this.requestUpdate();
                this.fallingRaf = requestAnimationFrame(tick);
            } else {
                this.fallingRaf = 0;
            }
        };
        this.fallingRaf = requestAnimationFrame(tick);
    }

    disconnectedCallback(): void {
        if (this.clipTimer) clearTimeout(this.clipTimer);
        if (this.fallingRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.fallingRaf);
    }

    protected override overlayMarkup(): string {
        if (this.getAttribute('show-hold') === null || this.getAttribute('show-hold') === 'false') return '';
        const coef = this.range.valueToCoef(this.top);
        const pos = coef * 100;
        const style = this.vertical
            ? `left: 0; right: 0; bottom: ${pos}%; height: 2px;`
            : `top: 0; bottom: 0; left: ${pos}%; width: 2px;`;
        return `<div class="hold" part="hold" style="${style}"></div>`;
    }
}

if (!customElements.get('aux-levelmeter')) {
    customElements.define('aux-levelmeter', AuxLevelMeter);
}
