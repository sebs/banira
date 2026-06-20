import sheet from './box.css' with { type: 'css' };

class SheetBox extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }).adoptedStyleSheets = [sheet];
    }
}

customElements.define('sheet-box', SheetBox);
