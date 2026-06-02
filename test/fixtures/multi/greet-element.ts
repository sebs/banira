import { greet } from './greet-helper.js';

class GreetElement extends HTMLElement {
    connectedCallback(): void {
        this.textContent = greet('world');
    }
}

customElements.define('greet-element', GreetElement);
