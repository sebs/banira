# banira.js

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
import { Compiler, ResultAnalyzer, DocGen, TestHelper } from 'banira';

// Compile TypeScript components to JavaScript
const compiler = new Compiler(['src/my-button.ts'], Compiler.DEFAULT_COMPILER_OPTIONS);
const analyzer = new ResultAnalyzer(compiler.emit());
if (analyzer.diag().hasErrors) throw new Error('compilation failed');

// Generate an HTML documentation page from @example tags
const docGen = new DocGen('my-button');
const page = docGen.renderDocs(await docGen.parseDoc('src/my-button.ts'));
```

| Class | Description |
|----|----|
| Compiler | Uses tsc to compile TypeScript files to JavaScript |
| TestHelper | Test web components in JSDOM (deterministic readiness) or, optionally, a real browser via Playwright (`mountInBrowser`) |
| DocGen | Generates an HTML documentation page (summary, `@demo`, and a full API reference) for a component |
| ManifestGenerator | Produces a [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) (`custom-elements.json`) from vanilla components |

## CLI

```bash
banira <command> [options]
```

### `banira compile <files...>`

Compile one or more TypeScript files with banira's compiler defaults.

| Option | Description |
|---|---|
| `-p, --project <path>` | Path to a `tsconfig.json` whose options override the defaults |
| `-o, --outDir <path>` | Directory to write the emitted JavaScript to |

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

```bash
banira doc src/my-button.ts -o docs/my-button.html
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

### `banira watch <files...>`

Recompile components whenever their source changes. Same options as `compile`
(`-p`, `-o`).

```bash
banira watch src/my-button.ts -o dist
```

### `banira serve [root]`

Serve a directory over HTTP with live reload (changes under the root trigger a
browser refresh). Pair it with `watch` for a compile-and-refresh dev loop.

| Option | Description |
|---|---|
| `-p, --port <number>` | Port to listen on (default `8080`) |

```bash
# terminal 1: rebuild on change
banira watch src/my-button.ts -o demo/dist
# terminal 2: serve the demo with live reload
banira serve demo
```

## Development

This software is a development build and work in progress. Your best shot will be
to build it using a unix or linux machine.

* `make bootstrap` - install dependencies and build
* `make test` - run the test suite
* `make lint` - type-check src and tests (strict)
* `make docs` - generate the API documentation
* `make clean` - remove build artifacts and dependencies

Project layout:

```
src/        library source; src/cli is the banira command
test/       test suite
examples/   reference components (my-circle), excluded from the package
dist/       build output (the published package)
```

## Examples

* [my-circle](./examples/my-circle/README.md) — minimal hand-written component

## License

MIT © Sebastian Schürmann
