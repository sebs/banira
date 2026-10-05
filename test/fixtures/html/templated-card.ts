import tpl from './card.html';

class TemplatedCard extends HTMLElement {
    constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.appendChild(tpl.content.cloneNode(true));
    }
}

customElements.define('templated-card', TemplatedCard);
