/**
 * A component that documents its full public surface and uses overridable host
 * styles — the linter should report no findings.
 *
 * @summary Clean component.
 * @csspart icon - The leading icon.
 * @slot - Default content.
 * @fires changed - Fired when the component changes.
 */
class LintClean extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot!.innerHTML =
            '<style>:host { color: var(--lint-clean-color, currentColor); }</style><span part="icon"></span><slot></slot>';
    }

    connectedCallback(): void {
        this.dispatchEvent(new CustomEvent('changed'));
    }
}

customElements.define('lint-clean', LintClean);
