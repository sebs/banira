/**
 * WebAudio Knob Control
 */
class WAKnob extends HTMLElement {
    private _value: number = 0;
    private _min: number = 0;
    private _max: number = 127;
    private _default: number = 0;
    private _defaultExplicitlySet: boolean = false;

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
        const newValue = this._constrainValue(val);
        if (newValue !== this._value) {
            this._value = newValue;
            this.render();
        }
    }

    get min() {
        return this._min;
    }

    set min(val: number) {
        // only set if there is a change
        if (val !== this._min) {
            this._min = val;
            // Update default if it wasn't explicitly set
            if (!this._defaultExplicitlySet) {
                this._default = val;
            }
            // Recheck value constraints
            this.value = this._value;
            this.render();
        }
    }

    get max() {
        return this._max;
    }

    set max(val: number) {
        if (val !== this._max) {
            this._max = val;
            // Recheck value constraints
            this.value = this._value;
        }
    }

    get default() {
        return this._default;
    }

    set default(val: number) {
        const newValue = this._constrainValue(val);
        if (newValue !== this._default) {
            this._default = newValue;
            this._defaultExplicitlySet = true;
            this.render();
        }
    }

    private _constrainValue(val: number): number {
        return Math.min(this._max, Math.max(this._min, val));
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue === newValue) return;

        const numValue = parseFloat(newValue || '0');
        const constrainedValue = this._constrainValue(numValue);

        switch (name) {
            case 'value':
                if (constrainedValue !== numValue) {
                    // If the value was constrained, update the attribute
                    this.setAttribute('value', constrainedValue.toString());
                } else {
                    this.value = numValue;
                }
                break;
            case 'min':
                this.min = numValue;
                break;
            case 'max':
                this.max = numValue;
                break;
            case 'default':
                this.default = numValue;
                break;
        }
    }

    connectedCallback() {
        // Initialize from attributes if present
        if (this.hasAttribute('min')) {
            this.min = parseFloat(this.getAttribute('min') || '0');
        }
        if (this.hasAttribute('max')) {
            this.max = parseFloat(this.getAttribute('max') || '127');
        }
        if (this.hasAttribute('default')) {
            this.default = parseFloat(this.getAttribute('default') || this._min.toString());
        } else {
            // If no default attribute, use min
            this._default = this._min;
        }
        if (this.hasAttribute('value')) {
            this.value = parseFloat(this.getAttribute('value') || this._default.toString());
        } else {
            // If no value attribute, use default
            this.value = this._default;
        }
        
        // Set initial attributes for HTML use
        this.setAttribute('value', this._value.toString());
        this.setAttribute('min', this._min.toString());
        this.setAttribute('max', this._max.toString());
        this.setAttribute('default', this._default.toString());
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
}

customElements.define('wa-knob', WAKnob);
