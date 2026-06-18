/**
 * A circle rendered with inline SVG, sized and coloured through attributes.
 *
 * @summary Resizable, recolourable SVG circle web component.
 *
 * @slot - Optional caption rendered beneath the circle.
 * @csspart circle - The SVG `<circle>` element, for styling from outside the shadow root.
 * @cssprop --circle-color - Overrides the fill colour set via the `color` attribute.
 * @fires size-change - Fired when the size changes, with `detail: { size }`.
 *
 * @demo
 * ```html
 * <my-circle size="80" color="rebeccapurple">Purple circle</my-circle>
 * ```
 */
class MyCircle extends HTMLElement {
    /** Radius of the circle, in pixels. */
    private _size: number = 50;
    /** Fill colour of the circle. */
    private _color: string = 'red';

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }



    static get observedAttributes() {
        return ['size', 'color'];
    }

    /** Radius of the circle, in pixels. */
    get size() {
        return this._size;
    }


    

    set size(value: number) {
        this._size = value;
        this.dispatchEvent(new CustomEvent('size-change', { detail: { size: value } }));    
        this.render();
    }

    /** Fill colour of the circle. */
    get color() {
        return this._color;
    }

    set color(value: string) {
        this._color = value;
        this.render();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'size':
                this.size = parseInt(newValue || '50');
                break;
            case 'color':
                this.color = newValue || 'black';
                break;
        }
    }

    private render() {
        if (!this.shadowRoot) return;

        // The `circle` part and the `--circle-color` custom property are real
        // styling hooks; `--circle-color` falls back to the `color` attribute.
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: inline-block; text-align: center; }
                circle { fill: var(--circle-color, ${this._color}); }
            </style>

            <svg width="${this._size * 2}" height="${this._size * 2}" viewBox="0 0 ${this._size * 2} ${this._size * 2}">
                <circle
                    part="circle"
                    cx="${this._size}"
                    cy="${this._size}"
                    r="${this._size}"
                    fill="${this._color}"
                />
            </svg>
            <slot></slot>
        `;
    }
}

customElements.define('my-circle', MyCircle);
