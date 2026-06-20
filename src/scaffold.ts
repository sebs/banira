import { designTokensToCss, type ImportedToken } from './design-tokens.js';

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
    /**
     * Scaffold a component that hydrates a prerendered Declarative Shadow DOM
     * root (adopt-or-render): if `banira prerender` already produced the shadow
     * markup, it is adopted without re-rendering (no flash); otherwise the
     * component renders normally. The constructable stylesheet is adopted either
     * way. Distinct from `formAssociated`/`aria`; pass one.
     */
    hydrate?: boolean;
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

function hydrateSource(tagName: string, className: string): string {
    return `/**
 * ${className} — a vanilla web component that **hydrates** a prerendered
 * Declarative Shadow DOM root instead of re-rendering it, so a server-rendered
 * page "wakes up" without a flash. Prerender it with \`banira prerender\`, ship
 * the DSD markup, and this script adopts it on load.
 *
 * @summary Describe what ${tagName} does.
 * @csspart label - The label element.
 * @cssprop --${tagName}-color - Text colour.
 * @fires ${tagName}-change - Fired when the value changes, with \`detail: { value }\`.
 */
// Shared constructable stylesheet (deduped across instances/modules). It is NOT
// part of the serialized DSD markup, so it is adopted on hydration to style the
// prerendered tree.
const sheet = new CSSStyleSheet();
sheet.replaceSync(\`:host { display: inline-block; color: var(--${tagName}-color, currentColor); }\`);

class ${className} extends HTMLElement {
    private _value: string = '';

    constructor() {
        super();
        // Adopt a prerendered DSD shadow root if the parser already attached one;
        // otherwise create an empty one to render into on connect.
        if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes(): string[] {
        return ['value'];
    }

    get value(): string {
        return this._value;
    }

    set value(next: string) {
        this._value = next;
        const label = this.shadowRoot?.querySelector('[part="label"]');
        if (label) label.textContent = next;
        this.dispatchEvent(new CustomEvent('${tagName}-change', { detail: { value: next } }));
    }

    connectedCallback(): void {
        const shadow = this.shadowRoot!;
        // A non-empty shadow root means the markup was prerendered (DSD) — adopt
        // it as-is, reading the current value from it. An empty root means a
        // client-only mount, so render from scratch.
        const prerendered = shadow.firstChild !== null;
        this._value =
            this.getAttribute('value') ??
            (prerendered ? shadow.querySelector('[part="label"]')?.textContent ?? '' : '');
        if (!prerendered) this.render();
        // Adopt the constructable stylesheet either way (see note above).
        shadow.adoptedStyleSheets = [sheet];
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) return;
        if (name === 'value') this.value = newValue ?? '';
    }

    private render(): void {
        this.shadowRoot!.innerHTML = \`<span part="label">\${this._value}</span><slot></slot>\`;
    }
}

customElements.define('${tagName}', ${className});
`;
}

function demoSource(tagName: string, variant: 'plain' | 'form-associated' | 'aria' | 'hydrate'): string {
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
    let variant: 'plain' | 'form-associated' | 'aria' | 'hydrate';
    if (options.formAssociated) {
        source = formAssociatedSource(tagName, className);
        variant = 'form-associated';
    } else if (options.aria) {
        source = ariaSource(tagName, className);
        variant = 'aria';
    } else if (options.hydrate) {
        source = hydrateSource(tagName, className);
        variant = 'hydrate';
    } else {
        source = componentSource(tagName, className);
        variant = 'plain';
    }
    return [
        { path: `${tagName}.ts`, content: source },
        { path: 'index.html', content: demoSource(tagName, variant) },
    ];
}

// ---------------------------------------------------------------------------
// Theme contract + <theme-toggle> scaffold (#29)
// ---------------------------------------------------------------------------

export interface ThemeScaffoldOptions {
    /** Tag name for the theme-switch component (default `theme-toggle`). */
    tagName?: string;
    /**
     * Seed the light `:root` token set from these imported DTCG tokens (see
     * `parseDesignTokens`) instead of the built-in default palette. The dark
     * block is then scaffolded as guidance for you to fill in, since a single
     * token document describes one theme.
     */
    tokens?: ImportedToken[];
}

/** Default light theme palette — semantic color tokens plus a few non-color basics. */
const LIGHT_PALETTE: ReadonlyArray<readonly [string, string]> = [
    ['--color-bg', '#ffffff'],
    ['--color-surface', '#f5f5f7'],
    ['--color-fg', '#1a1a1a'],
    ['--color-muted', '#6b7280'],
    ['--color-primary', '#3366ff'],
    ['--color-border', '#e5e7eb'],
];

/** Dark overrides for the color tokens (the contract's other half). */
const DARK_PALETTE: ReadonlyArray<readonly [string, string]> = [
    ['--color-bg', '#0b0d12'],
    ['--color-surface', '#161a22'],
    ['--color-fg', '#f3f4f6'],
    ['--color-muted', '#9ca3af'],
    ['--color-primary', '#6699ff'],
    ['--color-border', '#2a2f3a'],
];

/** Theme-independent tokens, declared once on `:root`. */
const STATIC_TOKENS: ReadonlyArray<readonly [string, string]> = [
    ['--space-md', '1rem'],
    ['--radius-md', '8px'],
    ['--font-sans', 'system-ui, -apple-system, sans-serif'],
];

function varsBlock(entries: ReadonlyArray<readonly [string, string]>, indent: string): string {
    return entries.map(([name, value]) => `${indent}${name}: ${value};`).join('\n');
}

const THEME_HEADER = `/* Theme contract — light is the default. Dark applies when the user selects it
   (data-theme="dark") or, with no explicit choice, when the OS prefers dark.
   An explicit data-theme="light" always wins over the OS preference. */`;

function themeCss(tokens?: ImportedToken[]): string {
    if (tokens && tokens.length > 0) {
        const root = designTokensToCss(tokens, { selector: ':root' }).trimEnd();
        const darkGuidance = tokens.map((t) => `    /* ${t.name}: <dark value>; */`).join('\n');
        return `${THEME_HEADER}
${root}

[data-theme="dark"] {
    /* Override the tokens above with their dark values, e.g.: */
${darkGuidance}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Repeat the [data-theme="dark"] overrides here. */
  }
}
`;
    }

    const light = varsBlock([...LIGHT_PALETTE, ...STATIC_TOKENS], '  ');
    const dark = varsBlock(DARK_PALETTE, '  ');
    const darkNested = varsBlock(DARK_PALETTE, '    ');
    return `${THEME_HEADER}
:root {
${light}
}

[data-theme="dark"] {
${dark}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${darkNested}
  }
}
`;
}

function themeToggleSource(tagName: string, className: string): string {
    return `/**
 * ${className} — a <${tagName}> that switches the document between light and
 * dark themes by setting \`data-theme\` on the root <html> element, persisting
 * the choice in localStorage so it survives reloads. With no stored choice the
 * OS preference (\`prefers-color-scheme\`) wins, matching theme.css.
 *
 * Pair it with the generated theme.css and add this to your <head> to apply the
 * stored theme before first paint (no flash):
 *   <script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
 *
 * @summary A light/dark theme switch.
 * @csspart button - The toggle button.
 * @fires ${tagName}-change - Fired after the theme changes, with \`detail: { theme: 'light' | 'dark' }\`.
 */
type Theme = 'light' | 'dark';
const STORAGE_KEY = 'theme';

class ${className} extends HTMLElement {
    private readonly button: HTMLButtonElement;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot!.innerHTML = \`
            <style>
                button {
                    font: inherit;
                    cursor: pointer;
                    color: var(--color-fg, currentColor);
                    background: var(--color-surface, transparent);
                    border: 1px solid var(--color-border, currentColor);
                    border-radius: var(--radius-md, 6px);
                    padding: 0.4em 0.8em;
                }
            </style>
            <button part="button" type="button" aria-pressed="false"><slot>Toggle theme</slot></button>
        \`;
        this.button = this.shadowRoot!.querySelector('button')!;
        this.button.addEventListener('click', () => this.toggle());
    }

    connectedCallback(): void {
        this.sync();
    }

    /** The active theme: an explicit stored choice, otherwise the OS preference. */
    get theme(): Theme {
        const stored = this.read();
        if (stored === 'light' || stored === 'dark') return stored;
        const mql = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
        return mql && mql.matches ? 'dark' : 'light';
    }

    set theme(next: Theme) {
        document.documentElement.setAttribute('data-theme', next);
        try {
            globalThis.localStorage?.setItem(STORAGE_KEY, next);
        } catch {
            // storage may be unavailable (private mode, sandboxed iframe) — ignore.
        }
        this.sync();
        this.dispatchEvent(new CustomEvent('${tagName}-change', { detail: { theme: next }, bubbles: true }));
    }

    private toggle(): void {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
    }

    private read(): string | null {
        try {
            return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
        } catch {
            return null;
        }
    }

    private sync(): void {
        const dark = this.theme === 'dark';
        this.button.setAttribute('aria-pressed', String(dark));
        this.button.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    }
}

customElements.define('${tagName}', ${className});
`;
}

function themeDemoSource(tagName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Theme demo</title>
    <!-- Apply the stored theme before first paint to avoid a flash. -->
    <script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
    <link rel="stylesheet" href="./theme.css" />
    <script type="module" src="./dist/${tagName}.js"></script>
    <style>
        body {
            margin: 0;
            padding: var(--space-md, 1rem);
            background: var(--color-bg, #fff);
            color: var(--color-fg, #000);
            font-family: var(--font-sans, system-ui, sans-serif);
        }
        .card {
            margin-top: var(--space-md, 1rem);
            padding: var(--space-md, 1rem);
            background: var(--color-surface, #f5f5f7);
            border: 1px solid var(--color-border, #ddd);
            border-radius: var(--radius-md, 8px);
        }
        a { color: var(--color-primary, #3366ff); }
    </style>
</head>
<body>
    <${tagName}>Toggle theme</${tagName}>
    <div class="card">
        <h1>Themed content</h1>
        <p>This card is styled entirely with theme tokens. <a href="#">A link</a> uses the primary color.</p>
    </div>
</body>
</html>
`;
}

/**
 * Generates a theming starter: a `theme.css` light/dark contract (token sets via
 * custom properties, switched by `data-theme` and `prefers-color-scheme`), a
 * `<theme-toggle>` component that flips `data-theme` and persists the choice, and
 * a demo page wiring them together. Pass `{ tokens }` (from `parseDesignTokens`)
 * to seed the light `:root` set from a DTCG document.
 *
 * @throws Error if `tagName` is not a valid custom element name.
 */
export function scaffoldTheme(options: ThemeScaffoldOptions = {}): ScaffoldFile[] {
    const tagName = options.tagName ?? 'theme-toggle';
    if (!isCustomElementName(tagName)) {
        throw new Error(`"${tagName}" is not a valid custom element name (must be lowercase and contain a hyphen)`);
    }
    const className = classNameFor(tagName);
    return [
        { path: 'theme.css', content: themeCss(options.tokens) },
        { path: `${tagName}.ts`, content: themeToggleSource(tagName, className) },
        { path: 'index.html', content: themeDemoSource(tagName) },
    ];
}
