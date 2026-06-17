# Roadmap

> Direction, not a promise. Items and ordering will change as the project and
> the web-components ecosystem evolve.

banira already produces a [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
(CEM), and the CEM is the hub of the modern web-components ecosystem. Most of the
highest-value work below is a *pure transform of a manifest banira already
generates* — small, framework-free, and squarely on banira's "no bundler, no
framework, modern standards" mission.

Where a capability already exists elsewhere (notably
[bennypowers/cem](https://github.com/bennypowers/cem) and
[wc-toolkit](https://github.com/wc-toolkit)), banira's value is shipping it
**first-party in one cohesive vanilla toolchain** — no analyzer-plugin config,
because banira owns the producer — and picking the genuinely underserved niches.

## Guiding principles

- **Vanilla first.** No framework runtime, no required bundler.
- **The manifest is the hub.** Generate downstream artifacts from the CEM banira
  already emits.
- **Modern standards as the target.** Lower to Baseline-safe web platform
  features; don't chase pre-implementation proposals.
- **Each step ships independently.** Small, composable CLI subcommands.

## Tier 1 — CEM-driven generators (highest leverage, lowest effort)

banira owns the producer; these are downstream transforms it is uniquely
positioned to ship.

| Feature | What it does | Prior art |
|---|---|---|
| **Markdown API docs** (`banira manifest --md` / `banira doc --format md`) | Emit README/API tables (attributes, properties, events, slots, CSS parts/props) from the manifest | [@custom-elements-manifest/to-markdown](https://www.npmjs.com/package/@custom-elements-manifest/to-markdown) |
| **IDE editor data** (`banira editor-data`) | Emit VS Code `*.custom-data.json` and JetBrains `web-types.json` for autocomplete/hover | [cem-plugin-vs-code-custom-data-generator](https://github.com/break-stuff/cem-plugin-vs-code-custom-data-generator), [JetBrains web-types](https://github.com/JetBrains/web-types) |
| **Manifest validation** (`banira manifest --validate`) | Validate emitted manifest against the official CEM schema (2.1.0) before writing | [cem validate](https://github.com/bennypowers/cem), [@wc-toolkit/cem-validator](https://www.npmjs.com/package/@wc-toolkit/cem-validator) |
| **Type shims** (`banira types`) | Emit `.d.ts` augmenting `HTMLElementTagNameMap` + `JSX.IntrinsicElements` so vanilla/React 19/Preact/Solid consumers get typed elements | [@wc-toolkit/jsx-types](https://github.com/wc-toolkit/jsx-types) |
| **Manifest diff** (`banira manifest diff a.json b.json`) | Compare two manifests, report additive vs breaking API changes (semver hint) | [wc-toolkit changelog](https://github.com/wc-toolkit) |

Recommended starting point: **Markdown API docs** — smallest, most
self-contained, immediately useful for READMEs.

## Tier 2 — Manifest-quality foundation

The Tier 1 generators are only as good as the manifest. These extraction gaps in
[`src/manifest.ts`](src/manifest.ts) are worth closing first; several are really
limitations/bugs in their own right.

- JSDoc descriptions on properties and methods (today only the class-level
  `@summary` is captured).
- `@deprecated`, `@readonly`, `@internal` markers.
- Distinction between HTML attributes and DOM properties.
- `@param` / return descriptions for methods.
- Event payload `type` beyond the constructor name.

## Tier 3 — Dev loop & DX (the biggest differentiator)

- **HMR for custom elements.** The single biggest unsolved DX gap in vanilla
  web components — the custom-element registry is immutable per tag name, so a
  proxy/prototype-swap strategy is required
  ([Open WC HMR](https://open-wc.org/docs/development/hot-module-replacement/),
  [custom-elements-hmr-polyfill](https://github.com/vegarringdal/custom-elements-hmr-polyfill)).
  banira's [`serve`](src/cli/actions/serve.ts) already injects a live-reload
  script; upgrading full-reload → HMR would be a flagship feature.
- **Unified `banira dev`.** Combine [`watch`](src/cli/actions/watch.ts) and
  [`serve`](src/cli/actions/serve.ts) into one command (currently two terminals).
- **On-the-fly TS transform in `serve`.** Serve unbundled ESM with per-file
  transforms, removing the separate compile step
  ([@web/dev-server](https://modern-web.dev/docs/dev-server/overview/) model).

## Tier 4 — Testing

- **`banira test` CLI runner** wrapping the existing
  [`TestHelper`](src/test-helper.ts) (today library-only).
- **Manifest-driven smoke tests** — for each tag in the manifest,
  `document.createElement(tag)` and assert it upgrades/renders. No turnkey
  package exists for this; it builds directly on `TestHelper`. Near-unique.
- **Accessibility assertions** via axe-core injection in `mountInBrowser`. Works
  only with *open* shadow roots — which banira can enforce/document
  ([testing a11y with shadow roots](https://dev.to/westbrook/testing-accessibility-with-shadow-roots-55cm)).
- **Visual snapshot** helpers on the Playwright path (`toHaveScreenshot`).

## Tier 5 — Standards & authoring

Build targets are gated on [Baseline](https://web-platform-dx.github.io/web-features-explorer/)
status (mid-2026).

**Ship (Baseline-safe targets):**

- **Constructable-stylesheet lowering.** Lower a `styles.css` import into a
  singleton `CSSStyleSheet` + `adoptedStyleSheets`, so every instance shares one
  parse instead of duplicating `<style>`. `adoptedStyleSheets` is Baseline
  *widely available* (2025-09-27).
  [web.dev](https://web.dev/articles/constructable-stylesheets)
- **CSS Module Scripts → constructable-stylesheet shim.** Accept the standard
  `import sheet from './x.css' with { type: 'css' }` syntax and lower it to the
  shim above (CSS Module Scripts are not yet Baseline — Safari lacks support).
  [caniuse](https://caniuse.com/wf-css-modules)
- **Declarative Shadow DOM prerender** (`banira prerender`). Emit
  `<template shadowrootmode="open">` snapshots; DSD is Baseline since 2024-02-20.
  [web.dev](https://web.dev/articles/declarative-shadow-dom)
- **Theming / design-tokens table.** Render a per-component CSS-custom-property
  table from the manifest (banira already parses `cssProperties`). Underserved
  niche — no dedicated generator exists.

**Scaffold / warn, don't transform:**

- **`banira init` scaffold.** No neutral, framework-free generator exists (the
  popular [Open WC generator](https://open-wc.org/docs/development/generator/)
  nudges toward Lit). Could scaffold form-associated
  ([`ElementInternals`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals))
  wiring and warn about Firefox's missing ARIA/role reflection.
- **Scoped custom element registries.** Chromium-only (Chrome/Edge 146+); needs
  the [`@webcomponents/scoped-custom-element-registry`](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Scoped-Custom-Element-Registries.md)
  polyfill. Only worth it if collision-free composition becomes a goal.

**Explicitly _not_ targeted** (pre-implementation proposals, no stable browser
support): DOM Parts, Template Instantiation, HTML Modules, Declarative Custom
Elements.

## Sequencing

1. **Tier 2 manifest fixes** + **Tier 1 Markdown docs** — foundation plus the
   smallest visible win.
2. Remaining **Tier 1** generators (validation, IDE data, type shims, diff).
3. **Constructable-stylesheet lowering** (Tier 5) — small, Baseline-safe, on-brand.
4. **HMR** (Tier 3) — high-ceiling flagship.
5. Testing and remaining standards work as demand dictates.
