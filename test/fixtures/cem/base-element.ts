/** Shared base class for the kit (abstract; never registered itself). */
export abstract class BaseElement extends HTMLElement {
    protected readonly root: ShadowRoot;
    constructor() {
        super();
        this.root = this.attachShadow({ mode: 'open' });
    }
}
