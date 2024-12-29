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

        // Calculate rotation angle based on value
        const range = this._max - this._min;
        const normalizedValue = (this._value - this._min) / range;
        const angle = normalizedValue * 270 - 135; // -135 to +135 degrees range

        this.shadowRoot.innerHTML = `
            <style>
                .knob-body {
                    width: 60px;
                    height: 60px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .knob-svg {
                    width: 100%;
                    height: 100%;
                }
                .knob-base {
                    fill: #444;
                    stroke: #666;
                    stroke-width: 2;
                }
                .knob-indicator {
                    stroke: #fff;
                    stroke-width: 2;
                    stroke-linecap: round;
                }
                .ctrl-label {
                    margin-top: 5px;
                    text-align: center;
                }
            </style>
            <div class='knob-body'>
                <svg class="knob-svg" viewBox="0 0 60 60">
                    <circle class="knob-base" cx="30" cy="30" r="25"/>
                    <line class="knob-indicator" 
                          x1="30" 
                          y1="30" 
                          x2="30" 
                          y2="10" 
                          transform="rotate(${angle}, 30, 30)"/>
                </svg>
                <div part="label" class="ctrl-label">
                    <slot></slot>
                </div>
            </div>
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
