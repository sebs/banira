// CLI command data — mirrors src/cli/index.ts (the source of truth for flags).
// Keep in sync with the commander definitions there; the build renders one page
// per command plus the /cli/ index from this list.

export const commands = [
  {
    name: 'init',
    summary: 'Scaffold a starter vanilla web component — a TypeScript source file plus a demo page wired for <code>banira serve</code>.',
    args: [
      { name: 'tag-name', desc: 'Custom element tag name (must contain a hyphen).' },
      { name: 'dir', desc: 'Directory to scaffold into.', optional: true, default: '.' },
    ],
    options: [
      { flag: '--force', desc: 'Overwrite existing files instead of leaving them untouched.' },
    ],
    examples: [
      { label: 'scaffold into src/', cmd: 'banira init my-button src' },
    ],
    notes: `<p>The generated source uses shadow DOM, an observed attribute/property, an event, and the
      <code>@slot</code> / <code>@csspart</code> / <code>@cssprop</code> / <code>@fires</code> jsdoc tags that
      banira's manifest and doc tooling read. Existing files are left untouched unless <code>--force</code> is given.</p>`,
  },
  {
    name: 'dev',
    summary: 'The one-command dev loop: watch, compile, and serve with live reload, so a source edit recompiles and the browser refreshes.',
    args: [{ name: 'files...', desc: 'TypeScript files to compile.' }],
    options: [
      { flag: '-p, --project <path>', desc: 'Path to a tsconfig.json whose options override the defaults.' },
      { flag: '-o, --output <path>', desc: 'Directory to write compiled output to.' },
      { flag: '-r, --root <path>', desc: 'Directory to serve (defaults to the output dir, or .).' },
      { flag: '--port <number>', desc: 'Port to listen on.', default: '8080' },
      { flag: '--host <host>', desc: 'Host/interface to bind.', default: '127.0.0.1' },
      { flag: '--ts', desc: 'Serve TypeScript transpiled on the fly (no separate compile step).' },
    ],
    examples: [
      { label: 'watch + serve a demo', cmd: 'banira dev src/my-button.ts -o demo/dist -r demo' },
    ],
    notes: `<p>The served root defaults to the output directory. With <code>--ts</code>, a <code>.ts</code> request is
      served as an ES module and a request for <code>foo.js</code> falls back to a sibling <code>foo.ts</code> when no
      compiled <code>foo.js</code> exists — so you can point a page at <code>./my-button.js</code> and skip the build
      during development.</p>`,
  },
  {
    name: 'watch',
    summary: 'Recompile components whenever their source changes. Same options as <code>compile</code>.',
    args: [{ name: 'files...', desc: 'TypeScript files to compile.' }],
    options: [
      { flag: '-p, --project <path>', desc: 'Path to a tsconfig.json whose options override the defaults.' },
      { flag: '-o, --output <path>', desc: 'Output directory.' },
    ],
    examples: [
      { label: 'rebuild on change', cmd: 'banira watch src/my-button.ts -o dist' },
    ],
    notes: `<p>Pair it with <a href="/cli/serve/">serve</a> for a compile-and-refresh dev loop, or just use
      <a href="/cli/dev/">dev</a>, which combines the two.</p>`,
  },
  {
    name: 'serve',
    summary: 'Serve a directory over HTTP with live reload — changes under the root trigger a browser refresh.',
    args: [{ name: 'root', desc: 'Directory to serve.', optional: true, default: '.' }],
    options: [
      { flag: '-p, --port <number>', desc: 'Port to listen on.', default: '8080' },
      { flag: '--host <host>', desc: 'Host/interface to bind. Use 0.0.0.0 to expose on the network.', default: '127.0.0.1' },
      { flag: '--ts', desc: 'Serve TypeScript transpiled on the fly (no separate compile step).' },
    ],
    examples: [
      { label: 'serve a demo folder', cmd: 'banira serve demo' },
    ],
    notes: `<p>Binds <code>127.0.0.1</code> only, so the server is not reachable from the network unless you opt in with
      <code>--host 0.0.0.0</code>. With <code>--ts</code>, a request for <code>foo.js</code> falls back to a sibling
      <code>foo.ts</code> when no compiled file exists.</p>`,
  },
  {
    name: 'compile',
    summary: "Compile one or more TypeScript files with banira's compiler defaults.",
    args: [{ name: 'files...', desc: 'TypeScript files to compile.' }],
    options: [
      { flag: '-p, --project <path>', desc: "Path to a tsconfig.json whose options override the defaults." },
      { flag: '-o, --output <path>', desc: 'Directory to write the emitted JavaScript to.' },
    ],
    examples: [
      { label: 'compile to dist/', cmd: 'banira compile src/my-button.ts -o dist' },
    ],
    notes: `<p>Uses <code>Compiler.DEFAULT_COMPILER_OPTIONS</code> unless you pass your own via <code>--project</code>.
      The underlying <code>Compiler</code> is also available as a library export.</p>`,
  },
  {
    name: 'manifest',
    summary: 'Generate a Custom Elements Manifest (custom-elements.json) — the ecosystem-standard descriptor that powers IDE autocomplete, Storybook controls and template type-checking.',
    args: [{ name: 'files...', desc: 'Component source files to analyze.' }],
    options: [
      { flag: '-o, --output <path>', desc: 'Write the output to a file instead of stdout.' },
      { flag: '--md', desc: 'Emit Markdown API documentation instead of JSON.' },
      { flag: '--validate', desc: 'Validate the generated manifest and print a report (exit 1 on errors).' },
    ],
    examples: [
      { label: 'write the manifest', cmd: 'banira manifest src/*.ts -o custom-elements.json' },
      { label: 'Markdown API tables for a README', cmd: 'banira manifest src/*.ts --md -o API.md' },
    ],
    notes: `<p>Attributes are read from <code>observedAttributes</code>, properties/methods from public class members,
      events from <code>new CustomEvent(...)</code>, and slots / CSS parts / CSS custom properties from class jsdoc tags
      (<code>@slot</code>, <code>@csspart</code>, <code>@cssprop</code>, <code>@fires</code>). Members marked
      <code>@deprecated</code> carry the note through; <code>@internal</code> / <code>@ignore</code> members are omitted.
      See <a href="/docs/authoring-components/">Authoring components</a> for the full tag reference.</p>`,
  },
  {
    name: 'types',
    summary: 'Generate a self-contained .d.ts from the manifest that augments HTMLElementTagNameMap so document.querySelector and document.createElement are typed for consumers.',
    args: [{ name: 'files...', desc: 'Component source files to analyze.' }],
    options: [
      { flag: '-o, --output <path>', desc: 'Write the .d.ts to a file instead of stdout.' },
      { flag: '--jsx', desc: 'Also augment JSX.IntrinsicElements.' },
    ],
    examples: [
      { label: 'emit typings', cmd: 'banira types src/*.ts -o dist/elements.d.ts' },
    ],
    notes: `<p>No runtime import is required by consumers — shipping the <code>.d.ts</code> alongside your package is enough
      to type <code>my-el</code> in <code>querySelector</code>/<code>createElement</code>. With <code>--jsx</code>,
      JSX intrinsic elements are augmented too.</p>`,
  },
  {
    name: 'editor-data',
    summary: 'Generate editor IntelliSense data from the manifest so consumers get autocomplete and hover docs for your custom elements.',
    args: [{ name: 'files...', desc: 'Component source files to analyze.' }],
    options: [
      { flag: '-o, --out-dir <dir>', desc: 'Directory to write the data files to.', default: '.' },
    ],
    examples: [
      { label: 'write into .vscode', cmd: 'banira editor-data src/*.ts -o .vscode' },
    ],
    notes: `<p>Emits VS Code HTML/CSS <code>*.custom-data.json</code> and a JetBrains <code>web-types.json</code>, all
      written to the output directory.</p>`,
  },
  {
    name: 'doc',
    summary: 'Generate an HTML documentation page for a component — the TSDoc summary and @demo blocks combined with a full API reference derived from the manifest.',
    args: [{ name: 'file', desc: 'TypeScript file to document.' }],
    options: [
      { flag: '-o, --output <path>', desc: 'Write the page to a file instead of stdout.' },
      { flag: '--script-src <path>', desc: 'Component module src used in the page.', default: './dist/<tag>.js' },
      { flag: '--stylesheet <value>', desc: "A URL, a local .css file to inline, or 'none'.", default: 'PicoCSS CDN' },
    ],
    examples: [
      { label: 'write a doc page', cmd: 'banira doc src/my-button.ts -o docs/my-button.html' },
      { label: 'offline / self-contained page', cmd: 'banira doc src/my-button.ts --stylesheet ./theme.css --script-src ./my-button.js' },
    ],
    notes: `<p>The reference covers attributes, properties, methods, events, slots, CSS parts and CSS custom properties.
      By default the page links PicoCSS from a CDN, so it needs network access to be styled. For a fully offline page,
      pass a local <code>.css</code> file to <code>--stylesheet</code> — it is inlined — or <code>none</code> for no
      stylesheet at all.</p>`,
  },
  {
    name: 'diff',
    summary: 'Compare two custom-elements.json files and report API changes with a suggested semver release type — useful as a release gate.',
    args: [
      { name: 'baseline', desc: 'Baseline custom-elements.json.' },
      { name: 'current', desc: 'Current custom-elements.json.' },
    ],
    options: [
      { flag: '--json', desc: 'Emit the diff as JSON.' },
    ],
    examples: [
      { label: 'compare two manifests', cmd: 'banira diff old/custom-elements.json custom-elements.json' },
    ],
    notes: `<p>Removals / type changes suggest <code>major</code>, additions suggest <code>minor</code>, otherwise
      <code>patch</code>. See <a href="/docs/ci-and-release/">CI &amp; release</a> for wiring it into a release gate.</p>`,
  },
  {
    name: 'test',
    summary: 'Manifest-driven smoke test: for every custom element found in the sources, banira compiles its module, mounts it in JSDOM, and asserts the tag registers and upgrades.',
    args: [{ name: 'files...', desc: 'Component source files to test.' }],
    options: [],
    examples: [
      { label: 'smoke-test every element', cmd: 'banira test src/*.ts' },
    ],
    notes: `<p>Catches the most common breakages — a component that throws on construction, or never calls
      <code>customElements.define</code> — with no per-component test code. Exits non-zero if any element fails, so it
      drops straight into CI.</p>`,
  },
  {
    name: 'prerender',
    summary: 'Render the components to static HTML using Declarative Shadow DOM.',
    args: [{ name: 'files...', desc: 'Component source files to prerender.' }],
    options: [
      { flag: '-o, --output <path>', desc: 'Write the markup to a file instead of stdout.' },
    ],
    examples: [
      { label: 'prerender to a file', cmd: 'banira prerender src/*.ts -o prerendered.html' },
    ],
    notes: `<p>Uses <a href="https://web.dev/articles/declarative-shadow-dom">Declarative Shadow DOM</a> so the
      shadow content is present in the served HTML — useful for first paint and for consumers without JavaScript enabled.</p>`,
  },
];
