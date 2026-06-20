import styles from './box.css';

class StyledBox extends HTMLElement {
    constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.adoptedStyleSheets = [styles];
        root.innerHTML = '<div class="box"></div>';
    }
}

customElements.define('styled-box', StyledBox);
