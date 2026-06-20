/**
 * A component with several Gold Standard / documentation gaps, for the linter:
 * an undocumented dispatched event, an undocumented `part`, an undocumented
 * default slot, a non-overridable `:host` rule, and an observed attribute with
 * no jsdoc description.
 *
 * @summary Lint fixture with gaps.
 */
class LintElement extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['label'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot!.innerHTML =
            '<style>:host { color: red !important; }</style><span part="icon"></span><slot></slot>';
    }

    connectedCallback(): void {
        this.dispatchEvent(new CustomEvent('changed'));
    }
}

customElements.define('lint-element', LintElement);
