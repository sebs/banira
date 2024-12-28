/**
 * WebAudio Knob Control
 */
class WAKnob extends HTMLElement {
    private _value: number = 0;
    private _min: number = 0;
    private _max: number = 127;
    private _default: number = 0;

    static get observedAttributes() {
        return ['value', 'min', 'max', 'default'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    get value() {
        return this._value;
    }

    set value(val: number) {
        const newValue = this.constrainValue(val);
        if (newValue !== this._value) {
            this._value = newValue;
            this.setAttribute('value', newValue.toString());
            this.render();
        }
    }

    get min() {
        return this._min;
    }

    set min(val: number) {
        this._min = val;
        this.value = this._value; // Recheck constraints
    }

    get max() {
        return this._max;
    }

    set max(val: number) {
        this._max = val;
        this.value = this._value; // Recheck constraints
    }

    get default() {
        return this._default;
    }

    set default(val: number) {
        this._default = val;
        if (this._value === 0) {
            this.value = val;
        }
    }

    private constrainValue(val: number): number {
        return Math.min(this._max, Math.max(this._min, val));
    }

    private render() {
        if (!this.shadowRoot) return;
        this.shadowRoot.innerHTML = `
            <div>Value: ${this._value} (Min: ${this._min}, Max: ${this._max})</div>
        `;
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'value': {
                const val = parseFloat(newValue || '0');
                const constrained = this.constrainValue(val);
                this._value = constrained;
                this.setAttribute('value', constrained.toString());
                this.render();
                break;
            }
            case 'min':
                this.min = parseFloat(newValue || '0');
                break;
            case 'max':
                this.max = parseFloat(newValue || '127');
                break;
            case 'default':
                this.default = parseFloat(newValue || '0');
                break;
        }
    }

    connectedCallback() {
        // Set to default value if no value was specified
        if (this._value === 0 && this._default !== 0) {
            this.value = this._default;
        }
        this.setAttribute('value', this._value.toString());
        this.setAttribute('default', this._default.toString());
        this.setAttribute('min', this._min.toString());
        this.setAttribute('max', this._max.toString());
        this.render();
    }
}

customElements.define('wa-knob', WAKnob);
