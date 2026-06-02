/**
 * A custom web component that renders a button with customizable styles.
 * 
 * @example
 * ```html
 * <custom-button type="primary" size="large">Click me</custom-button>
 * ```
 */
/**
 * A demo of a custom button component with different styles and sizes.
 * 
 * @demo
 * ```html
 * <custom-button type="primary" size="large">Primary Large</custom-button>
 * <custom-button type="secondary" size="medium">Secondary Medium</custom-button>
 * <custom-button type="ghost" size="small">Ghost Small</custom-button>
 * ```
 */
class CustomButton extends HTMLElement {
    /** The button type: 'primary', 'secondary', or 'ghost'. Default is 'primary'. */
    private _type: string = 'primary';
    /** The button size: 'small', 'medium', or 'large'. Default is 'medium'. */
    private _size: string = 'medium';

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    static get observedAttributes() {
        return ['type', 'size'];
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue !== newValue) {
            if (name === 'type') this._type = newValue;
            if (name === 'size') this._size = newValue;
            this.render();
        }
    }

    private render() {
        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: inline-block;
            }
            button {
                font-family: system-ui;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                transition: all 0.2s;
            }
            button.primary {
                background: #0066cc;
                color: white;
            }
            button.secondary {
                background: #e0e0e0;
                color: #333;
            }
            button.ghost {
                background: transparent;
                border: 1px solid #0066cc;
                color: #0066cc;
            }
            button.small {
                padding: 4px 8px;
                font-size: 12px;
            }
            button.medium {
                padding: 8px 16px;
                font-size: 14px;
            }
            button.large {
                padding: 12px 24px;
                font-size: 16px;
            }
        `;

        const button = document.createElement('button');
        button.className = `${this._type} ${this._size}`;
        button.innerHTML = '<slot></slot>';

        this.shadowRoot!.innerHTML = '';
        this.shadowRoot!.appendChild(style);
        this.shadowRoot!.appendChild(button);
    }
}

customElements.define('custom-button', CustomButton);
