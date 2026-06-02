/**
 * ValueWidget — base for the value-bearing controls (knob, fader, slider).
 *
 * Centralises everything those controls share: a {@link Range}, reflected
 * `value/min/max/step/disabled` attributes + properties, pointer drag, wheel,
 * full keyboard support, ARIA slider semantics, and the `input`/`change` event
 * contract. Subclasses only implement {@link renderControl} (the visual) and
 * {@link dragOptions} (drag direction/basis).
 */
import { WidgetBase } from './widget-base.js';
import { Range, type ScaleLaw } from './range.js';
import { attachDragValue, type DragValueOptions } from './drag-value.js';
import { attachScrollValue } from './scroll-value.js';

export abstract class ValueWidget extends WidgetBase {
    protected range = new Range();
    private disposers: Array<() => void> = [];

    static get observedAttributes(): string[] {
        return ['value', 'min', 'max', 'step', 'scale', 'disabled'];
    }

    // --- properties (kept in sync with the Range and reflected to attributes) ---

    get value(): number {
        return this.range.options.min === this.range.options.max
            ? this.range.options.min
            : this._value;
    }
    set value(v: number) {
        this._value = this.range.clamp(v);
        this.reflect('value', this._value);
        this.updateAria();
        this.requestUpdate();
    }
    private _value = 0;

    get min(): number {
        return this.range.options.min;
    }
    set min(v: number) {
        this.range.set('min', v);
        this.reflect('min', v);
        this.value = this._value;
    }

    get max(): number {
        return this.range.options.max;
    }
    set max(v: number) {
        this.range.set('max', v);
        this.reflect('max', v);
        this.value = this._value;
    }

    get step(): number {
        return this.range.options.step;
    }
    set step(v: number) {
        this.range.set('step', v);
        this.reflect('step', v);
    }

    get scale(): ScaleLaw {
        return this.range.options.scale;
    }
    set scale(v: ScaleLaw) {
        this.range.set('scale', v);
        this.requestUpdate();
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled');
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '');
        else this.removeAttribute('disabled');
    }

    // --- lifecycle ---

    connectedCallback(): void {
        // Seed options from attributes before the base performs its first render.
        if (this.hasAttribute('min')) this.range.set('min', this.numAttr('min', 0));
        if (this.hasAttribute('max')) this.range.set('max', this.numAttr('max', 1));
        if (this.hasAttribute('step')) this.range.set('step', this.numAttr('step', 0));
        if (this.hasAttribute('scale')) this.range.set('scale', this.getAttribute('scale') as ScaleLaw);
        this._value = this.range.clamp(this.numAttr('value', this._value));

        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
        if (!this.hasAttribute('role')) this.setAttribute('role', 'slider');
        this.updateAria();

        super.connectedCallback();
        this.attachInteractions();
    }

    disconnectedCallback(): void {
        this.disposers.forEach((d) => d());
        this.disposers = [];
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
        if (value === null) return;
        switch (name) {
            case 'value':
                this.value = parseFloat(value);
                break;
            case 'min':
                this.min = parseFloat(value);
                break;
            case 'max':
                this.max = parseFloat(value);
                break;
            case 'step':
                this.step = parseFloat(value);
                break;
            case 'scale':
                this.scale = value as ScaleLaw;
                break;
        }
    }

    // --- interaction wiring ---

    private attachInteractions(): void {
        const setFromUser = (v: number) => this.userValue(v);
        const get = () => this._value;

        this.disposers.push(
            attachDragValue(
                this,
                this.range,
                { ...this.dragOptions(), get, set: setFromUser },
                {
                    onStart: () => this.classList.add('aux-dragging'),
                    onEnd: () => {
                        this.classList.remove('aux-dragging');
                        this.emit('change', { value: this._value });
                    },
                }
            )
        );
        this.disposers.push(
            attachScrollValue(this, this.range, { scroll_direction: [0, -1, 0], get, set: setFromUser }, {
                onScroll: () => this.emit('change', { value: this._value }),
            })
        );

        const onKey = (ev: KeyboardEvent) => this.onKeyDown(ev);
        this.addEventListener('keydown', onKey);
        this.disposers.push(() => this.removeEventListener('keydown', onKey));
    }

    private onKeyDown(ev: KeyboardEvent): void {
        if (this.disabled) return;
        const o = this.range.options;
        const stepSize = o.step > 0 ? o.step : (o.max - o.min) / 100;
        let next: number | undefined;
        switch (ev.key) {
            case 'ArrowUp':
            case 'ArrowRight':
                next = this._value + stepSize;
                break;
            case 'ArrowDown':
            case 'ArrowLeft':
                next = this._value - stepSize;
                break;
            case 'PageUp':
                next = this._value + stepSize * 10;
                break;
            case 'PageDown':
                next = this._value - stepSize * 10;
                break;
            case 'Home':
                next = o.min;
                break;
            case 'End':
                next = o.max;
                break;
            default:
                return;
        }
        ev.preventDefault();
        this.userValue(this.range.snap(next));
        this.emit('change', { value: this._value });
    }

    /** Subclass hook: when true, pointer/wheel/keyboard input is ignored. */
    protected blockUserInput(): boolean {
        return false;
    }

    /** Applies a user-initiated value change and emits `input`. */
    protected userValue(v: number): void {
        if (this.disabled || this.blockUserInput()) return;
        const clamped = this.range.clamp(v);
        if (clamped === this._value) return;
        this.value = clamped;
        this.emit('input', { value: this._value });
    }

    private reflect(name: string, value: number): void {
        const str = String(value);
        if (this.getAttribute(name) !== str) {
            // Avoid attributeChangedCallback feedback loops.
            this.setAttribute(name, str);
        }
    }

    private updateAria(): void {
        const o = this.range.options;
        this.setAttribute('aria-valuemin', String(o.min));
        this.setAttribute('aria-valuemax', String(o.max));
        this.setAttribute('aria-valuenow', String(this._value));
    }

    /** Current value as a normalised coefficient in `[0, 1]`. */
    protected coef(): number {
        return this.range.valueToCoef(this._value);
    }

    /** Drag configuration (direction/basis/rotation) for this control. */
    protected abstract dragOptions(): Partial<DragValueOptions>;

    /** Paint the control; called by the base on every coalesced update. */
    protected abstract renderControl(): void;

    protected render(): void {
        this.renderControl();
    }
}
