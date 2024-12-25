import { test } from './test.js';

export class MyCircle extends HTMLElement {
    private shadow: ShadowRoot;

    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
    }
    
    connectedCallback() {
        this.render();
        test()
    }

    render() {
        this.shadow.innerHTML = `
            <div>
                <h2>My Circle</h2>
                <div id="circle"></div>
            </div> 
        `;
    }
}

customElements.define('my-circle', MyCircle);