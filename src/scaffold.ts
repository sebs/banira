export interface ScaffoldFile {
    /** Path relative to the target directory. */
    path: string;
    content: string;
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

function demoSource(tagName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${tagName} demo</title>
    <script type="module" src="./dist/${tagName}.js"></script>
</head>
<body>
    <${tagName} value="Hello">world</${tagName}>
</body>
</html>
`;
}

/**
 * Generates the files for a starter vanilla web component: a TypeScript source
 * file (shadow DOM, an observed attribute/property, an event, and the
 * `@slot` / `@csspart` / `@cssprop` / `@fires` jsdoc tags banira's manifest and
 * doc tooling read) plus a demo HTML page wired for `banira serve`.
 *
 * @throws Error if `tagName` is not a valid custom element name.
 */
export function scaffoldComponent(tagName: string): ScaffoldFile[] {
    if (!isCustomElementName(tagName)) {
        throw new Error(`"${tagName}" is not a valid custom element name (must be lowercase and contain a hyphen)`);
    }
    const className = classNameFor(tagName);
    return [
        { path: `${tagName}.ts`, content: componentSource(tagName, className) },
        { path: 'index.html', content: demoSource(tagName) },
    ];
}
