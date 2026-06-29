// Lint-rule reference — one page per `banira lint` rule, each with a flagged
// (bad) and a good example. Rendered by build.mjs into /docs/lint-rules/<id>/.
//
// The `id`s here MUST match LINT_RULES in src/lint.ts (a test enforces it), so
// the public URL /docs/lint-rules/<id> is deterministic from the rule id — the
// same mapping as ruleDocsUrl(id) in src/lint.ts.

import { code } from './docs.mjs';

/** Each rule: { id, label, description, why (html), bad: {label, lines}, good: {label, lines} }. */
export const lintRules = [
  {
    id: 'reflection',
    label: 'Attribute/property reflection',
    description: 'observed attributes reflect to/from their backing property',
    why: `<p>An observed attribute and its property should stay in sync: setting the property updates the attribute
(<em>property → attribute</em>), and changing the attribute updates the element (<em>attribute → property</em>).
Frameworks, templates and tooling rely on this round-trip; when it's missing, <code>el.value = 'x'</code> and
<code>el.setAttribute('value', 'x')</code> drift apart. banira mounts the element and checks each observed attribute
round-trips.</p>`,
    bad: {
      label: 'src/my-field.ts — property never writes the attribute',
      lines: [
        'export class MyField extends HTMLElement {',
        "  static observedAttributes = ['value'];",
        '  #value = "";',
        '  get value() { return this.#value; }',
        '  // setting the property does NOT update the attribute → they diverge',
        '  set value(v) { this.#value = v; }',
        '}',
        "customElements.define('my-field', MyField);",
      ],
    },
    good: {
      label: 'src/my-field.ts — property and attribute reflect both ways',
      lines: [
        'export class MyField extends HTMLElement {',
        "  static observedAttributes = ['value'];",
        "  get value() { return this.getAttribute('value') ?? ''; }",
        "  set value(v) { this.setAttribute('value', v); }      // property → attribute",
        '  attributeChangedCallback() { this.render(); }         // attribute → element',
        '}',
        "customElements.define('my-field', MyField);",
      ],
    },
  },
  {
    id: 'host-overridable',
    label: 'Overridable :host styles',
    description: ':host styles avoid !important so consumers can override them',
    why: `<p><code>!important</code> in a <code>:host</code> rule wins against anything a consumer writes, so they can no
longer restyle your component from the outside — it breaks the platform's cascade. Prefer normal specificity and expose
intentional knobs as CSS custom properties. banira flags any <code>:host</code> selector that uses <code>!important</code>.</p>`,
    bad: {
      label: 'shadow CSS — consumers cannot override these',
      lines: [
        ':host {',
        '  display: inline-flex !important;',
        '  color: var(--fg) !important;',
        '}',
      ],
    },
    good: {
      label: 'shadow CSS — overridable, with a custom-property hook',
      lines: [
        ':host {',
        '  display: inline-flex;',
        '  color: var(--fg, currentColor);',
        '}',
      ],
    },
  },
  {
    id: 'undocumented-event',
    label: 'Documented events',
    description: 'dispatched events are documented with @fires',
    why: `<p>Events are part of a component's public API. Documenting each one with a class-level <code>@fires</code> tag
puts it in the Custom Elements Manifest — and therefore in the generated types, editor data and docs — so consumers can
discover it. banira flags any event it sees dispatched that has no <code>@fires</code> entry.</p>`,
    bad: {
      label: 'src/my-toggle.ts — event dispatched but undocumented',
      lines: [
        'export class MyToggle extends HTMLElement {',
        '  toggle() {',
        "    this.dispatchEvent(new CustomEvent('change', { detail: { on: this.on } }));",
        '  }',
        '}',
        "customElements.define('my-toggle', MyToggle);",
      ],
    },
    good: {
      label: 'src/my-toggle.ts — @fires documents the event',
      lines: [
        '/**',
        ' * @fires change - when the toggle flips; detail: { on: boolean }',
        ' */',
        'export class MyToggle extends HTMLElement {',
        '  toggle() {',
        "    this.dispatchEvent(new CustomEvent('change', { detail: { on: this.on } }));",
        '  }',
        '}',
        "customElements.define('my-toggle', MyToggle);",
      ],
    },
  },
  {
    id: 'undocumented-attribute',
    label: 'Documented attributes',
    description: 'observed attributes have a jsdoc description',
    why: `<p>Observed attributes are public inputs. A jsdoc description on the attribute's accessor flows into the manifest,
the generated docs and IDE autocomplete. banira flags any observed attribute whose manifest entry has no description.</p>`,
    bad: {
      label: 'src/my-button.ts — observed attribute with no description',
      lines: [
        'export class MyButton extends HTMLElement {',
        "  static observedAttributes = ['variant'];",
        "  get variant() { return this.getAttribute('variant') ?? 'primary'; }",
        '  set variant(v) { this.setAttribute(\'variant\', v); }',
        '}',
        "customElements.define('my-button', MyButton);",
      ],
    },
    good: {
      label: 'src/my-button.ts — the accessor carries a jsdoc description',
      lines: [
        'export class MyButton extends HTMLElement {',
        "  static observedAttributes = ['variant'];",
        "  /** Visual style: 'primary' | 'secondary' | 'ghost'. */",
        "  get variant() { return this.getAttribute('variant') ?? 'primary'; }",
        '  set variant(v) { this.setAttribute(\'variant\', v); }',
        '}',
        "customElements.define('my-button', MyButton);",
      ],
    },
  },
  {
    id: 'undocumented-part',
    label: 'Documented CSS parts',
    description: 'exposed part="…" elements are documented with @csspart',
    why: `<p>A <code>part="…"</code> attribute is a styling contract: it lets consumers target inner elements with
<code>::part()</code>. Document each exposed part with a class-level <code>@csspart</code> tag so the contract is
discoverable. banira mounts the element and flags any rendered <code>part</code> name that isn't documented.</p>`,
    bad: {
      label: 'src/my-button.ts — exposes a part but does not document it',
      lines: [
        'export class MyButton extends HTMLElement {',
        '  connectedCallback() {',
        "    this.attachShadow({ mode: 'open' }).innerHTML =",
        "      '<button part=\"button\"><slot></slot></button>';",
        '  }',
        '}',
        "customElements.define('my-button', MyButton);",
      ],
    },
    good: {
      label: 'src/my-button.ts — @csspart documents the exposed part',
      lines: [
        '/**',
        ' * @csspart button - the inner native button',
        ' */',
        'export class MyButton extends HTMLElement {',
        '  connectedCallback() {',
        "    this.attachShadow({ mode: 'open' }).innerHTML =",
        "      '<button part=\"button\"><slot></slot></button>';",
        '  }',
        '}',
        "customElements.define('my-button', MyButton);",
      ],
    },
  },
  {
    id: 'undocumented-slot',
    label: 'Documented slots',
    description: 'rendered <slot>s are documented with @slot (content model)',
    why: `<p>Slots define a component's content model — where consumer markup is projected. Document each rendered slot with
a class-level <code>@slot</code> tag (use <code>@slot - …</code> for the default slot). banira mounts the element and flags
any rendered slot that isn't documented.</p>`,
    bad: {
      label: 'src/my-field.ts — renders a named slot, undocumented',
      lines: [
        'export class MyField extends HTMLElement {',
        '  connectedCallback() {',
        "    this.attachShadow({ mode: 'open' }).innerHTML =",
        "      '<label><slot name=\"label\"></slot><input></label>';",
        '  }',
        '}',
        "customElements.define('my-field', MyField);",
      ],
    },
    good: {
      label: 'src/my-field.ts — @slot documents the content model',
      lines: [
        '/**',
        " * @slot label - the field's label content",
        ' */',
        'export class MyField extends HTMLElement {',
        '  connectedCallback() {',
        "    this.attachShadow({ mode: 'open' }).innerHTML =",
        "      '<label><slot name=\"label\"></slot><input></label>';",
        '  }',
        '}',
        "customElements.define('my-field', MyField);",
      ],
    },
  },
];

/** The body HTML for one rule's page: id, rationale, then the flagged and good examples. */
export function lintRuleBody(rule) {
  return `
<p style="font-size:1.05rem; line-height:1.6; color:var(--muted);">${rule.description}.</p>
<div class="callout"><strong>Rule id <code>${rule.id}</code></strong> — run only this rule with
<code>banira lint src/*.ts --rules ${rule.id}</code>.</div>

<h2 id="why">Why it matters</h2>
${rule.why}

<h2 id="flagged">✗ Flagged</h2>
${code(rule.bad.label, rule.bad.lines, { prompt: false })}

<h2 id="good">✓ Good</h2>
${code(rule.good.label, rule.good.lines, { prompt: false })}
`;
}
