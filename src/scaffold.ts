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
    /**
     * Scaffold a custom element that reflects its ARIA role/state through
     * `ElementInternals` (the Accessibility Object Model) — a `checkbox`-role
     * toggle with `internals.role`/`ariaChecked` wiring and keyboard support,
     * instead of the plain starter component. Distinct from `formAssociated`;
     * pass one or the other.
     */
    aria?: boolean;
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

function ariaSource(tagName: string, className: string): string {
    return `/**
 * ${className} — a vanilla web component that reflects its ARIA semantics
 * through \`ElementInternals\` (the Accessibility Object Model), so it needs no
 * \`role\`/\`aria-*\` attributes in the light DOM.
 *
 * The implicit role and the checked/disabled state are exposed to assistive
 * technology via \`internals.role\`, \`internals.ariaChecked\` and
 * \`internals.ariaDisabled\`. Keyboard activation (Space/Enter) and focusability
 * are wired up so the control behaves like a native checkbox.
 *
 * Caveat: Firefox does not yet reflect ARIA set through \`ElementInternals\`
 * (see https://bugzilla.mozilla.org/show_bug.cgi?id=1693577). Until it does,
 * mirror the state to host attributes (e.g. \`this.setAttribute('aria-checked', …)\`)
 * if you need Firefox to expose the role/state to assistive technology.
 *
 * @summary Describe what ${tagName} does.
 * @role checkbox
 * @csspart box - The check indicator.
 * @cssprop [--${tagName}-color=currentColor] - Text colour.
 * @fires ${tagName}-change - Fired when the checked state changes, with \`detail: { checked }\`.
 */
class ${className} extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['checked', 'disabled'];
    }

    private readonly internals: ElementInternals;
    private _checked: boolean = false;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.internals = this.attachInternals();
        // The implicit ARIA role, exposed to assistive tech without a role attribute.
        this.internals.role = 'checkbox';
        this.render();
        this.addEventListener('click', () => this.toggle());
        this.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                this.toggle();
            }
        });
    }

    connectedCallback(): void {
        if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
        this.reflectAria();
    }

    /** Whether the control is checked; reflected to \`aria-checked\` via internals. */
    get checked(): boolean {
        return this._checked;
    }

    set checked(next: boolean) {
        this._checked = next;
        this.reflectAria();
        this.dispatchEvent(new CustomEvent('${tagName}-change', { detail: { checked: next } }));
        this.render();
    }

    /** Whether the control is disabled; reflected to \`aria-disabled\` via internals. */
    get disabled(): boolean {
        return this.hasAttribute('disabled');
    }

    private toggle(): void {
        if (this.disabled) return;
        this.checked = !this._checked;
    }

    /** Reflects the current state to assistive technology through \`ElementInternals\`. */
    private reflectAria(): void {
        this.internals.ariaChecked = String(this._checked);
        this.internals.ariaDisabled = String(this.disabled);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) return;
        if (name === 'checked') this.checked = newValue !== null;
        else this.reflectAria();
    }

    private render(): void {
        if (!this.shadowRoot) return;
        this.shadowRoot.innerHTML = \`
            <style>
                :host { display: inline-flex; align-items: center; gap: 0.5em; cursor: pointer; color: var(--${tagName}-color, currentColor); }
                :host([disabled]) { opacity: 0.5; cursor: not-allowed; }
                [part="box"] { inline-size: 1em; block-size: 1em; border: 1px solid currentColor; display: inline-grid; place-items: center; }
            </style>
            <span part="box">\${this._checked ? '✓' : ''}</span>
            <slot></slot>
        \`;
    }
}

customElements.define('${tagName}', ${className});
`;
}

function demoSource(tagName: string, variant: 'plain' | 'form-associated' | 'aria'): string {
    let body: string;
    if (variant === 'form-associated') {
        body = `    <form>
        <label>Field: <${tagName} name="field" value="Hello" required></${tagName}></label>
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
    </form>`;
    } else if (variant === 'aria') {
        body = `    <${tagName}>Accept the terms</${tagName}>`;
    } else {
        body = `    <${tagName} value="Hello">world</${tagName}>`;
    }
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
 * (`static formAssociated = true` + `ElementInternals` form/validation wiring),
 * and `{ aria: true }` scaffolds an ARIA role/state-reflecting element
 * (`ElementInternals.role`/`ariaChecked` wiring). `formAssociated` and `aria`
 * are distinct starters; pass one or the other.
 *
 * @throws Error if `tagName` is not a valid custom element name.
 */
export function scaffoldComponent(tagName: string, options: ScaffoldOptions = {}): ScaffoldFile[] {
    if (!isCustomElementName(tagName)) {
        throw new Error(`"${tagName}" is not a valid custom element name (must be lowercase and contain a hyphen)`);
    }
    const className = classNameFor(tagName);
    let source: string;
    let variant: 'plain' | 'form-associated' | 'aria';
    if (options.formAssociated) {
        source = formAssociatedSource(tagName, className);
        variant = 'form-associated';
    } else if (options.aria) {
        source = ariaSource(tagName, className);
        variant = 'aria';
    } else {
        source = componentSource(tagName, className);
        variant = 'plain';
    }
    return [
        { path: `${tagName}.ts`, content: source },
        { path: 'index.html', content: demoSource(tagName, variant) },
    ];
}
