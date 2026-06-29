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
      { flag: '--form-associated', desc: 'Scaffold a form-associated element (static formAssociated = true + ElementInternals form/validation wiring).' },
      { flag: '--aria', desc: 'Scaffold an ARIA role/state-reflecting element (ElementInternals.role/ariaChecked, keyboard support, @role in the manifest).' },
      { flag: '--hydrate', desc: 'Scaffold a component that hydrates a prerendered Declarative Shadow DOM root (adopt-or-render, no flash).' },
    ],
    examples: [
      { label: 'scaffold into src/', cmd: 'banira init my-button src' },
      { label: 'a checkbox-role toggle (ElementInternals)', cmd: 'banira init my-toggle src --aria' },
    ],
    notes: `<p>The generated source uses shadow DOM, an observed attribute/property, an event, and the
      <code>@slot</code> / <code>@csspart</code> / <code>@cssprop</code> / <code>@fires</code> jsdoc tags that
      banira's manifest and doc tooling read. Existing files are left untouched unless <code>--force</code> is given.</p>
      <p>The variant flags scaffold a different starter: <code>--form-associated</code> (a <code>&lt;form&gt;</code>-participating
      control), <code>--aria</code> (an accessible toggle whose role/state is exposed via <code>ElementInternals</code>), or
      <code>--hydrate</code> (a component that adopts its prerendered DSD root on the client). Pass one.</p>`,
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
      { flag: '--hmr', desc: 'Hot-swap custom elements in place instead of a full-page reload.' },
      { flag: '--import-map', desc: 'Inject a <script type="importmap"> (esm.sh) for the served modules’ bare imports.' },
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
      { flag: '--hmr', desc: 'Hot-swap custom elements in place instead of a full-page reload.' },
      { flag: '--import-map', desc: 'Inject a <script type="importmap"> (esm.sh) for the served modules’ bare imports.' },
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
      { flag: '--import-map [path]', desc: 'Also emit an import map (esm.sh) for the components’ bare imports; optional output path.' },
      { flag: '--optimize-css', desc: 'Run inlined CSS through lightningcss (lower nesting, minify). Optional dependency.' },
      { flag: '--no-source-map', desc: 'Do not emit source maps (which embed the original TypeScript).' },
    ],
    examples: [
      { label: 'compile to dist/', cmd: 'banira compile src/my-button.ts -o dist' },
      { label: 'also pin bare imports to a CDN', cmd: 'banira compile src/my-button.ts -o dist --import-map' },
    ],
    notes: `<p>Uses <code>Compiler.DEFAULT_COMPILER_OPTIONS</code> unless you pass your own via <code>--project</code>.
      The underlying <code>Compiler</code> is also available as a library export. Each <code>.js</code> ships a
      <code>.js.map</code> (original TypeScript embedded) by default — pass <code>--no-source-map</code> for production builds.
      With <code>--import-map</code>, bare imports resolve in the browser from <a href="https://esm.sh/">esm.sh</a> with no bundler.</p>`,
  },
  {
    name: 'manifest',
    summary: 'Generate a Custom Elements Manifest (custom-elements.json) — the ecosystem-standard descriptor that powers IDE autocomplete, Storybook controls and template type-checking.',
    args: [{ name: 'files...', desc: 'Component source files to analyze.' }],
    options: [
      { flag: '-o, --output <path>', desc: 'Write the output to a file instead of stdout.' },
      { flag: '--md', desc: 'Emit Markdown API documentation instead of JSON.' },
      { flag: '--validate', desc: 'Validate the generated manifest and print a report (exit 1 on errors). Also checks the official CEM JSON Schema when the optional ajv dependency is installed.' },
      { flag: '--link-package', desc: 'Point the nearest package.json’s customElements field at the written manifest (the convention IDEs and Storybook use to auto-discover it).' },
    ],
    examples: [
      { label: 'write the manifest', cmd: 'banira manifest src/*.ts -o custom-elements.json' },
      { label: 'Markdown API tables for a README', cmd: 'banira manifest src/*.ts --md -o API.md' },
      { label: 'write + link it from package.json', cmd: 'banira manifest src/*.ts -o custom-elements.json --link-package' },
    ],
    notes: `<p>Attributes are read from <code>observedAttributes</code>, properties/methods from public class members,
      events from <code>new CustomEvent(...)</code>, and slots / CSS parts / CSS custom properties from class jsdoc tags
      (<code>@slot</code>, <code>@csspart</code>, <code>@cssprop</code>, <code>@fires</code>). Members marked
      <code>@deprecated</code> carry the note through; <code>@internal</code> / <code>@ignore</code> members are omitted.
      An attribute backed by a string-literal union (<code>'sm' | 'md' | 'lg'</code>) captures its allowed values, which
      flow through to the <code>.d.ts</code> union, editor autocomplete and Storybook <code>select</code> options.
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
    name: 'mcp',
    summary: 'Run banira as a Model Context Protocol (stdio) server, so an AI coding assistant can introspect, verify, document and scaffold your vanilla components against banira’s real data — the manifest and actual compiler/test results — instead of hallucinating component APIs.',
    args: [],
    options: [
      { flag: '--read-only', desc: 'Expose only the read/analysis tools — no file writes or scaffolding. Safe to leave always-on.' },
      { flag: '--local-only', desc: 'Confine file access to the project (cwd or --project dir) and never emit network-reaching output (e.g. force a local doc stylesheet instead of the CDN).' },
      { flag: '-p, --project <path>', desc: 'Path to a tsconfig.json whose options override the compiler defaults for the compile/analysis tools.' },
    ],
    examples: [
      { label: 'run the server', cmd: 'banira mcp' },
      { label: 'always-on, read-only', cmd: 'banira mcp --read-only' },
      { label: 'inspect it interactively', cmd: 'npx @modelcontextprotocol/inspector npx banira mcp' },
    ],
    notes: `<p>Add it to any MCP client's config:</p>
<pre>{
  "mcpServers": {
    "banira": { "command": "npx", "args": ["-y", "banira", "mcp"] }
  }
}</pre>
      <p>It exposes <strong>10 tools</strong> — introspection (<code>get_component_manifest</code>,
      <code>get_component_api</code>, <code>list_components</code>, <code>get_component_demo</code>), verify
      (<code>check_component</code>, <code>compile_component</code>, <code>test_component</code>), <code>generate_docs</code>,
      and authoring (<code>get_authoring_guidelines</code>, <code>scaffold_component</code>) — plus <strong>2 resources</strong>
      (<code>resource://banira/components</code>, <code>resource://banira/authoring-guide</code>) and <strong>3 prompts</strong>.
      It speaks newline-delimited JSON-RPC 2.0 (MCP <code>2025-11-25</code>) and adds no heavy dependencies. See the
      <a href="/docs/mcp-server/">MCP server guide</a> for the full catalog and setup.</p>`,
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
    options: [
      { flag: '--reflection', desc: 'Also round-trip each observed attribute ↔ its backing property and warn on either direction that doesn’t reflect.' },
      { flag: '--slots', desc: 'Also inject sample slotted content and warn on declared @slots with no matching <slot> (and shadow <slot>s with no @slot).' },
    ],
    examples: [
      { label: 'smoke-test every element', cmd: 'banira test src/*.ts' },
      { label: 'also check reflection + slots', cmd: 'banira test src/*.ts --reflection --slots' },
    ],
    notes: `<p>Catches the most common breakages — a component that throws on construction, or never calls
      <code>customElements.define</code> — with no per-component test code. Exits non-zero if any element fails, so it
      drops straight into CI. <code>--reflection</code> and <code>--slots</code> add advisory warnings (they don’t fail
      the command), since not every attribute is meant to reflect.</p>`,
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
      shadow content is present in the served HTML — useful for first paint and for consumers without JavaScript enabled.
      A component's constructable stylesheet is inlined as critical CSS so the markup is styled before JS (FOUC-free).</p>
      <p>For programmatic SSR, the <code>createPrerenderer(files)</code> library export returns
      <code>renderToString(tag, { attributes, children })</code> for meta-frameworks, and <code>createEleventyPlugin</code>
      wires that into an <a href="https://www.11ty.dev/">Eleventy</a> build. On the client, <code>hydrateShadow</code>
      adopts the prerendered root (no re-render, no flash).</p>`,
  },
  {
    name: 'lint',
    summary: 'Audit components against a subset of the Gold Standard Checklist plus documentation coverage of their public surface — reflection, overridable :host styles, and documented events/attributes/parts/slots.',
    args: [{ name: 'files...', desc: 'Component source files to lint.' }],
    options: [
      { flag: '--strict', desc: 'Treat warnings as errors and exit non-zero if any finding (for CI).' },
      { flag: '--rules <ids>', desc: 'Comma-separated rule ids to run (default: all).' },
      { flag: '--json', desc: 'Emit findings as JSON.' },
    ],
    examples: [
      { label: 'lint every element', cmd: 'banira lint src/*.ts' },
      { label: 'fail CI on any finding', cmd: 'banira lint src/*.ts --strict' },
    ],
    notes: `<p>Each element is mounted in JSDOM and checked by independent, id'd rules: <code>reflection</code>,
      <code>host-overridable</code>, and the documentation-coverage rules <code>undocumented-event</code> /
      <code>-attribute</code> / <code>-part</code> / <code>-slot</code>. Findings are advisory warnings by default (exit 0);
      <code>--strict</code> makes them fail the build.</p>`,
  },
  {
    name: 'stories',
    summary: 'Generate Storybook Component Story Format (*.stories.js) from the components — an argTypes controls panel derived from each element’s attributes (string-literal unions become select options) and events (mapped to actions), with zero hand-written story code.',
    args: [{ name: 'files...', desc: 'Component source files to analyze.' }],
    options: [
      { flag: '-o, --out-dir <dir>', desc: 'Directory to write the stories to.', default: '.' },
      { flag: '--import-path <path>', desc: 'Module imported per story so the element registers (default ./{tag}.js).' },
    ],
    examples: [
      { label: 'write one story per element', cmd: 'banira stories src/*.ts -o stories' },
    ],
    notes: `<p>Pair with <a href="https://storybook.js.org/docs/web-components/get-started/install">@storybook/web-components</a>;
      in <code>.storybook/preview.js</code>, call <code>setCustomElementsManifest(manifest)</code> (from a
      <code>banira manifest</code>-generated <code>custom-elements.json</code>) for richer auto-docs.</p>`,
  },
  {
    name: 'tokens',
    summary: 'Generate a theming / design-tokens document (Markdown) from the components’ CSS custom properties, grouped per component and by token namespace.',
    args: [{ name: 'files...', desc: 'Component source files to analyze.' }],
    options: [
      { flag: '-o, --output <path>', desc: 'Write the document to a file instead of stdout.' },
      { flag: '--title <title>', desc: 'Document title.', default: 'Design Tokens' },
    ],
    examples: [
      { label: 'write a tokens doc', cmd: 'banira tokens src/*.ts -o TOKENS.md' },
    ],
    notes: `<p>Reads the <code>@cssprop</code> custom properties from the manifest. Complements <code>manifest --md</code>’s
      inline per-component table with a dedicated, grouped theming reference.</p>`,
  },
  {
    name: 'tokens-css',
    summary: 'Compile a W3C Design Tokens (DTCG) tokens.json into :root CSS custom properties, resolving {alias} references.',
    args: [{ name: 'tokens.json', desc: 'DTCG design tokens document.' }],
    options: [
      { flag: '-o, --output <path>', desc: 'Write the stylesheet to a file instead of stdout.' },
      { flag: '--selector <selector>', desc: 'CSS selector for the custom properties.', default: ':root' },
    ],
    examples: [
      { label: 'tokens.json → CSS', cmd: 'banira tokens-css design.tokens.json -o tokens.css' },
    ],
    notes: `<p>Groups become dashed name segments (<code>color.primary</code> → <code>--color-primary</code>),
      <code>$type</code> is inherited from parent groups, and <code>{alias}</code> references are resolved —
      so vanilla components can use a standards-based token pipeline with no design-system runtime.</p>`,
  },
  {
    name: 'theme',
    summary: 'Scaffold a light/dark theme contract, a <theme-toggle> component, and a demo page — token sets via custom properties, switched by data-theme and prefers-color-scheme.',
    args: [{ name: 'dir', desc: 'Directory to scaffold into.', optional: true, default: '.' }],
    options: [
      { flag: '--force', desc: 'Overwrite existing files.' },
      { flag: '--tag <tag-name>', desc: 'Tag name for the toggle component.', default: 'theme-toggle' },
      { flag: '--tokens <tokens.json>', desc: 'Seed the light :root token set from a DTCG document.' },
    ],
    examples: [
      { label: 'scaffold a theme', cmd: 'banira theme src/theme' },
      { label: 'seed from design tokens', cmd: 'banira theme src/theme --tokens design.tokens.json' },
    ],
    notes: `<p>Generates <code>theme.css</code> (a light/dark contract where an explicit <code>data-theme="light"</code>
      wins over the OS preference), a <code>&lt;theme-toggle&gt;</code> that flips <code>data-theme</code> and persists the
      choice, and a no-flash demo page.</p>`,
  },
];
