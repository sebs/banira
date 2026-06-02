"use strict";
class MyCircle extends HTMLElement {
    _size = 50;
    _color = 'red';
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }
    static get observedAttributes() {
        return ['size', 'color'];
    }
    get size() {
        return this._size;
    }
    set size(value) {
        this._size = value;
        this.render();
    }
    get color() {
        return this._color;
    }
    set color(value) {
        this._color = value;
        this.render();
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue)
            return;
        switch (name) {
            case 'size':
                this.size = parseInt(newValue || '50');
                break;
            case 'color':
                this.color = newValue || 'red';
                break;
        }
    }
    render() {
        if (!this.shadowRoot)
            return;
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
