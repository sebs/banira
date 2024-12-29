/**
 * A custom web component that renders a circle using SVG.
 * 
 * @example
 * ```html
 * <my-circle size="100" color="blue"></my-circle>
 * ```
 */
class MyCircle extends HTMLElement {
    /** The diameter of the circle in pixels. Default is 50. */
    private _size: number = 50;
    /** The fill color of the circle. Default is 'red'. */
    private _color: string = 'red';

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    /** @returns Array of attribute names to observe for changes */
    static get observedAttributes() {
        return ['size', 'color'];
    }

    /** 
     * Get the current size of the circle
     * @returns The diameter in pixels
     */
    get size() {
        return this._size;
    }

    /** 
     * Set the size of the circle
     * @param value - The diameter in pixels
     */
    set size(value: number) {
        this._size = value;
        this.render();
    }

    /** 
     * Get the current color of the circle
     * @returns The color value as a string
     */
    get color() {
        return this._color;
    }

    /** 
     * Set the color of the circle
     * @param value - Any valid CSS color value
     */
    set color(value: string) {
        this._color = value;
        this.render();
    }

    /**
     * Handles changes to observed attributes
     * @param name - Name of the changed attribute
     * @param oldValue - Previous value of the attribute
     * @param newValue - New value of the attribute
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'size':
                this.size = parseInt(newValue || '50');
                break;
            case 'color':
                this.color = newValue || 'red';
                break;
        }

        /**
         * @example
         * ```html
         * <my-circle size="11" color="blue"></my-circle>
         * ```
         */
    }

    /** Renders the SVG circle with current size and color */
    private render() {
        if (!this.shadowRoot) return;

        this.shadowRoot.innerHTML = `
            <svg width="${this._size * 2}" height="${this._size * 2}" viewBox="0 0 ${this._size * 2} ${this._size * 2}">
                <circle 
                    cx="${this._size}" 
                    cy="${this._size}" 
                    r="${this._size}" 
                    fill="${this._color}"
                />
            </svg>
        `;
    }
}

customElements.define('my-circle', MyCircle);
