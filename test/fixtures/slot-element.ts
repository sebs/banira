/**
 * Exercises the slot-contract check: declares a default slot, an `icon` slot
 * (both implemented) and a `missing` slot (not implemented). Its shadow also has
 * an `extra` slot that isn't documented.
 *
 * @summary Slot contract fixture.
 * @slot - Default content.
 * @slot icon - An icon before the content.
 * @slot missing - Declared but not implemented in the shadow root.
 */
class SlotElement extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot!.innerHTML = '<slot name="icon"></slot><slot></slot><slot name="extra"></slot>';
    }
}

customElements.define('slot-element', SlotElement);
