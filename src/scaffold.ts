export interface ScaffoldFile {
    /** Path relative to the target directory. */
    path: string;
    content: string;
}

export interface ScaffoldOptions {
    /**
     * Scaffold a form-associated custom element (`static formAssociated = true`
     * + `ElementInternals` wiring) that participates in `<form>` submission and
     * validation, instead of the plain starter component.
     */
    formAssociated?: boolean;
}

/** A valid custom-element tag name: lowercase, starts with a letter, contains a hyphen. */
function isCustomElementName(name: string): boolean {
    return /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/.test(name);
}

/** Derives a PascalCase class name from a tag name (`my-button` → `MyButton`). */
function classNameFor(tagName: string): string {
    return tagName
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join('');
}

function componentSource(tagName: string, className: string): string {
    return `/**
 * ${className} — a starter vanilla web component.
 *
 * @summary Describe what ${tagName} does.
 *
 * @slot - Default slotted content.
 * @csspart label - The label element.
 * @cssprop --${tagName}-color - Text colour.
 * @fires ${tagName}-change - Fired when the value changes, with \`detail: { value }\`.
 */
class ${className} extends HTMLElement {
    /** The component's current value. */
    private _value: string = '';

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    static get observedAttributes(): string[] {
        return ['value'];
    }

    /** The component's current value. */
    get value(): string {
        return this._value;
    }

    set value(next: string) {
        this._value = next;
        this.dispatchEvent(new CustomEvent('${tagName}-change', { detail: { value: next } }));
        this.render();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) return;
        if (name === 'value') this.value = newValue ?? '';
    }

    private render(): void {
        if (!this.shadowRoot) return;
        this.shadowRoot.innerHTML = \`
            <style>
                :host { display: inline-block; color: var(--${tagName}-color, currentColor); }
            </style>
            <span part="label">\${this._value}</span>
            <slot></slot>
        \`;
    }
}

customElements.define('${tagName}', ${className});
`;
}

function formAssociatedSource(tagName: string, className: string): string {
    return `/**
 * ${className} — a form-associated vanilla web component.
 *
 * A form-associated custom element participates in \`<form>\` submission,
 * validation and reset like a native control, via \`ElementInternals\`.
 *
 * Caveat: Firefox does not yet reflect ARIA role/state set through
 * \`ElementInternals\` (the \`accessibility\` parts of the spec). The value/
 * validation participation below works cross-browser; role reflection does not.
 *
 * @summary Describe what ${tagName} does.
 *
 * @csspart input - The inner input element.
 * @cssprop [--${tagName}-color=currentColor] - Text colour.
 * @fires ${tagName}-change - Fired when the value changes, with \`detail: { value }\`.
 */
class ${className} extends HTMLElement {
    /** Opt in to form association — required for \`attachInternals()\` form APIs. */
    static formAssociated = true;

    static get observedAttributes(): string[] {
        return ['value', 'disabled', 'required'];
    }

    private readonly internals: ElementInternals;
    private readonly input: HTMLInputElement;
    private _value: string = '';

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.internals = this.attachInternals();
        // Build the shadow DOM once; the input is updated in place afterwards so
        // typing never rebuilds the markup (which would drop focus/caret).
        this.shadowRoot!.innerHTML = \`
            <style>
                :host { display: inline-block; color: var(--${tagName}-color, currentColor); }
                input { font: inherit; color: inherit; }
            </style>
            <input part="input" />
        \`;
        this.input = this.shadowRoot!.querySelector('input')!;
        this.input.addEventListener('input', () => {
            this.value = this.input.value;
        });
    }

    /** The submitted value; mirrored to the owning form via \`setFormValue\`. */
    get value(): string {
        return this._value;
    }

    set value(next: string) {
        this._value = next;
        if (this.input.value !== next) this.input.value = next;
        this.internals.setFormValue(next);
        this.validate();
        this.dispatchEvent(new CustomEvent('${tagName}-change', { detail: { value: next } }));
    }

    get form(): HTMLFormElement | null {
        return this.internals.form;
    }

    get validity(): ValidityState {
        return this.internals.validity;
    }

    /** Called by the platform when the owning form is reset. */
    formResetCallback(): void {
        this.value = this.getAttribute('value') ?? '';
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) return;
        if (name === 'value') this.value = newValue ?? '';
        else if (name === 'disabled') this.input.disabled = this.hasAttribute('disabled');
        else this.validate();
    }

    private validate(): void {
        const required = this.hasAttribute('required');
        if (required && this._value === '') {
            this.internals.setValidity({ valueMissing: true }, 'Please fill out this field.');
        } else {
            this.internals.setValidity({});
        }
    }
}

customElements.define('${tagName}', ${className});
`;
}

function demoSource(tagName: string, formAssociated: boolean): string {
    const body = formAssociated
        ? `    <form>
        <label>Field: <${tagName} name="field" value="Hello" required></${tagName}></label>
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
    </form>`
        : `    <${tagName} value="Hello">world</${tagName}>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${tagName} demo</title>
    <script type="module" src="./dist/${tagName}.js"></script>
</head>
<body>
${body}
</body>
</html>
`;
}

/**
 * Generates the files for a starter vanilla web component: a TypeScript source
 * file (shadow DOM, an observed attribute/property, an event, and the
 * `@slot` / `@csspart` / `@cssprop` / `@fires` jsdoc tags banira's manifest and
 * doc tooling read) plus a demo HTML page wired for `banira serve`. With
 * `{ formAssociated: true }` it scaffolds a form-associated element instead
 * (`static formAssociated = true` + `ElementInternals` form/validation wiring).
 *
 * @throws Error if `tagName` is not a valid custom element name.
 */
export function scaffoldComponent(tagName: string, options: ScaffoldOptions = {}): ScaffoldFile[] {
    if (!isCustomElementName(tagName)) {
        throw new Error(`"${tagName}" is not a valid custom element name (must be lowercase and contain a hyphen)`);
    }
    const className = classNameFor(tagName);
    const source = options.formAssociated
        ? formAssociatedSource(tagName, className)
        : componentSource(tagName, className);
    return [
        { path: `${tagName}.ts`, content: source },
        { path: 'index.html', content: demoSource(tagName, Boolean(options.formAssociated)) },
    ];
}
