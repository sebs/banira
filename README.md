# banira.js

[![CI](https://github.com/sebs/banira/actions/workflows/ci.yml/badge.svg)](https://github.com/sebs/banira/actions/workflows/ci.yml)
[![Release](https://github.com/sebs/banira/actions/workflows/release.yml/badge.svg)](https://github.com/sebs/banira/actions/workflows/release.yml)
[![GitHub release](https://img.shields.io/github/v/release/sebs/banira)](https://github.com/sebs/banira/releases/latest)
[![npm](https://img.shields.io/npm/v/banira)](https://www.npmjs.com/package/banira)

> !!! WARNING: This is a work in progress. Please use at your own risk.

Rationale and background in a [blog post](https://dev.to/sebs/taking-llms-to-code-town-part-ii-creating-a-vanillajs-web-component-toolchain-from-ground-up-mi9)

banira.js is an open-source toolchain designed for the development of web
components using vanilla JavaScript. It simplifies the process by eliminating the
need for bundlers and frameworks, focusing instead on modern CSS and web
standards.

`banira` ships as a single package: a **library** you import, and a **`banira`
command-line tool** for compiling components and generating documentation.

## Install

```bash
# Library + CLI
npm install banira

# Or use the CLI without installing
npx banira --help
```

## Library

```ts
import { Compiler, ResultAnalyzer, DocGen, ManifestGenerator } from 'banira';

// Compile a component to browser-ready ES modules
// (uses Compiler.DEFAULT_COMPILER_OPTIONS unless you pass your own)
const compiler = new Compiler(['src/my-button.ts']);
const analyzer = new ResultAnalyzer(compiler.emit());
if (analyzer.diag().hasErrors) throw new Error('compilation failed');

// Generate an HTML documentation page (summary, @demo, and a full API reference)
const page = await new DocGen('my-button').generate('src/my-button.ts');

// Generate a Custom Elements Manifest, then derive artifacts from it
const manifest = new ManifestGenerator(['src/my-button.ts']).generate();
import { manifestToMarkdown, toTypeDefinitions } from 'banira';
const apiDocs = manifestToMarkdown(manifest);   // Markdown API tables
const dts = toTypeDefinitions(manifest);        // typed HTMLElementTagNameMap
```

| Export | Description |
|----|----|
| Compiler | Uses tsc to compile TypeScript files to JavaScript |
| TestHelper | Mount web components in JSDOM (including ones that **import sibling modules**) with deterministic readiness, or — optionally — a real browser via Playwright (`mountInBrowser`) |
| DocGen | Generates an HTML documentation page (summary, `@demo`, and a full API reference) for a component |
| ManifestGenerator | Produces a [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) (`custom-elements.json`) from vanilla components |
| manifestToMarkdown | Renders a manifest as Markdown API documentation |
| toVsCodeHtmlData / toVsCodeCssData / toWebTypes | Generate editor IntelliSense data (VS Code custom-data, JetBrains web-types) from a manifest |
| toTypeDefinitions | Generates a `.d.ts` typing the custom elements from a manifest |
| validateManifest | Structurally validates a manifest against the CEM 2.1.0 shape |
| diffManifests | Diffs two manifests and suggests a semver release type |

## CLI

```bash
banira <command> [options]
```

### `banira compile <files...>`

Compile one or more TypeScript files with banira's compiler defaults.

| Option | Description |
|---|---|
| `-p, --project <path>` | Path to a `tsconfig.json` whose options override the defaults |
| `-o, --output <path>` | Directory to write the emitted JavaScript to |

```bash
banira compile src/my-button.ts -o dist
```

### `banira doc <file>`

Generate an HTML documentation page for a component. Combines the TSDoc summary
and `@demo` blocks with a full API reference — attributes, properties, methods,
events, slots, CSS parts and CSS custom properties — derived from the manifest.
Writes to stdout unless `-o` is given.

| Option | Description |
|---|---|
| `-o, --output <path>` | Write the page to a file instead of stdout |
| `--script-src <path>` | Component module `src` used in the page (default `./dist/<tag>.js`) |
| `--stylesheet <value>` | A URL, a local `.css` file to inline, or `none` (default: PicoCSS CDN) |

By default the page links PicoCSS from a CDN, so it needs network access to be
styled. For a fully offline / self-contained page, pass a local `.css` file to
`--stylesheet` — it is inlined into the page.

```bash
banira doc src/my-button.ts -o docs/my-button.html

# self-contained / offline page: inline a local stylesheet, point at a custom build
banira doc src/my-button.ts --stylesheet ./theme.css --script-src ./my-button.js

# no stylesheet at all
banira doc src/my-button.ts --stylesheet none
```

### `banira manifest <files...>`

Generate a [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
(`custom-elements.json`) — the ecosystem-standard descriptor that powers IDE
autocomplete, Storybook controls and template type-checking. Writes to stdout
unless `-o` is given.

```bash
banira manifest src/*.ts -o custom-elements.json
```

Attributes are read from `observedAttributes`, properties/methods from public
class members, events from `new CustomEvent(...)`, and slots / CSS parts / CSS
custom properties from class jsdoc tags (`@slot`, `@csspart`, `@cssprop`, `@fires`).
Members marked `@deprecated` carry the note through; `@internal` / `@ignore`
members are omitted.

| Option | Description |
|---|---|
| `-o, --output <path>` | Write the output to a file instead of stdout |
| `--md` | Emit Markdown API documentation instead of JSON |
| `--validate` | Validate the generated manifest and print a report (exit 1 on errors) |

```bash
# Markdown API tables for a README
banira manifest src/*.ts --md -o API.md
```

### `banira editor-data <files...>`

Generate editor IntelliSense data from the manifest so consumers get autocomplete
and hover docs for your custom elements: VS Code HTML/CSS `*.custom-data.json`
and a JetBrains `web-types.json`, all written to the output directory.

| Option | Description |
|---|---|
| `-o, --out-dir <dir>` | Directory to write the data files to (default `.`) |

```bash
banira editor-data src/*.ts -o .vscode
```

### `banira types <files...>`

Generate a self-contained `.d.ts` from the manifest that augments
`HTMLElementTagNameMap` (and, with `--jsx`, `JSX.IntrinsicElements`) so
`document.querySelector('my-el')` and `document.createElement('my-el')` are
typed for consumers — no runtime import required.

| Option | Description |
|---|---|
| `-o, --output <path>` | Write the `.d.ts` to a file instead of stdout |
| `--jsx` | Also augment `JSX.IntrinsicElements` |

```bash
banira types src/*.ts -o dist/elements.d.ts
```

### `banira diff <baseline> <current>`

Compare two `custom-elements.json` files and report API changes with a suggested
semver release type (removals/type changes → `major`, additions → `minor`,
otherwise `patch`). Useful as a release gate.

| Option | Description |
|---|---|
| `--json` | Emit the diff as JSON |

```bash
banira diff old/custom-elements.json custom-elements.json
```

### `banira watch <files...>`

Recompile components whenever their source changes. Same options as `compile`
(`-p`, `-o`).

```bash
banira watch src/my-button.ts -o dist
```

### `banira serve [root]`

Serve a directory over HTTP with live reload (changes under the root trigger a
browser refresh). Pair it with `watch` for a compile-and-refresh dev loop.
Binds `127.0.0.1` only, so the server is not reachable from the network unless
you opt in with `--host`.

| Option | Description |
|---|---|
| `-p, --port <number>` | Port to listen on (default `8080`) |
| `--host <host>` | Host/interface to bind (default `127.0.0.1`; use `0.0.0.0` to expose on the network) |

```bash
# terminal 1: rebuild on change
banira watch src/my-button.ts -o demo/dist
# terminal 2: serve the demo with live reload
banira serve demo
```

### `banira dev <files...>`

The one-command dev loop: `watch` and `serve` together, so a source edit
recompiles and the browser refreshes. The served root defaults to the output
directory.

| Option | Description |
|---|---|
| `-p, --project <path>` | Path to a `tsconfig.json` whose options override the defaults |
| `-o, --output <path>` | Directory to write compiled output to |
| `-r, --root <path>` | Directory to serve (defaults to the output dir, or `.`) |
| `--port <number>` | Port to listen on (default `8080`) |
| `--host <host>` | Host/interface to bind (default `127.0.0.1`) |

```bash
banira dev src/my-button.ts -o demo/dist -r demo
```

### `banira test <files...>`

Manifest-driven smoke test: for every custom element found in the sources,
banira compiles its module, mounts it in JSDOM, and asserts the tag registers
and upgrades to an `HTMLElement` — catching the most common breakages (a
component that throws on construction, or never calls `customElements.define`)
with no per-component test code. Exits non-zero if any element fails.

```bash
banira test src/*.ts
```

### `banira init <tag-name> [dir]`

Scaffold a starter vanilla web component — a TypeScript source file (shadow DOM,
an observed attribute/property, an event, and the `@slot` / `@csspart` /
`@cssprop` / `@fires` jsdoc tags banira's manifest and doc tooling read) plus a
demo HTML page wired for `banira serve`. Existing files are left untouched
unless `--force` is given.

```bash
banira init my-button src
```

### `banira prerender <files...>`

Render the components to static HTML using
[Declarative Shadow DOM](https://web.dev/articles/declarative-shadow-dom)
(`<template shadowrootmode="open">`), so they display — shadow DOM and all —
before any JavaScript runs. Components are mounted in JSDOM and their shadow
root serialized. Writes to stdout unless `-o` is given.

```bash
banira prerender src/my-button.ts -o prerendered.html
```

## Development

Build, test and release instructions live in [DEVELOPMENT.md](./DEVELOPMENT.md).

## Examples

* [my-circle](./examples/my-circle/README.md) — minimal hand-written component

## License

MIT © Sebastian Schürmann
