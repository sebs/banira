// Docs guides — hand-written conceptual content. Rendered by build.mjs into
// /docs/<slug>/. Each guide: { slug, label, title, desc, sub, body }.

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A copyable shell code block. `lines` are plain command/source lines.
export function code(label, lines, { prompt = true } = {}) {
  const copy = lines.join('\n').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
  const body = lines.map(l => {
    const e = esc(l);
    return prompt && l && !l.startsWith('#') && !l.startsWith(' ')
      ? `<span class="dim">$</span> ${e}` : (l.startsWith('#') ? `<span class="dim">${e}</span>` : e);
  }).join('\n');
  return `<div class="codeblock"><div class="cb-bar"><span class="lbl">${esc(label)}</span><span class="grow"></span>` +
    `<button class="copy sm" data-copy="${copy}">copy</button></div><pre>${body}</pre></div>`;
}

export const guides = [
  {
    slug: 'getting-started',
    label: 'Getting started',
    title: 'Getting started — banira.js',
    desc: 'Install banira, scaffold a component, and run the watch-compile-serve dev loop.',
    sub: 'From an empty folder to a live, reloading web component in about a minute.',
    body: `
<h2 id="install">Install</h2>
<p>banira ships as a single package — a library you import and a <code>banira</code> command-line tool. Install it,
or run the CLI without installing via <code>npx</code>.</p>
${code('install', ['# library + CLI', 'npm install banira', '', '# or use the CLI without installing', 'npx banira --help'], { prompt: false })}

<h2 id="scaffold">Scaffold a component</h2>
<p><a href="/cli/init/"><code>banira init</code></a> writes a starter vanilla web component — a TypeScript source file
(shadow DOM, an observed attribute, an event, and the jsdoc tags banira's tooling reads) plus a demo HTML page wired
for the dev server.</p>
${code('scaffold', ['banira init my-button src'])}
<p>Existing files are left untouched unless you pass <code>--force</code>.</p>

<h2 id="dev-loop">The dev loop</h2>
<p><a href="/cli/dev/"><code>banira dev</code></a> is watch, compile, and serve in one command: edit the source and the
browser refreshes. The served root defaults to the output directory.</p>
${code('dev loop', ['banira dev src/my-button.ts -o demo/dist -r demo'])}
<div class="callout"><strong>Skip the build during development.</strong> Add <code>--ts</code> and banira serves
TypeScript transpiled on the fly — a request for <code>foo.js</code> falls back to a sibling <code>foo.ts</code> when
no compiled file exists.</div>

<h2 id="test">Smoke-test it</h2>
<p><a href="/cli/test/"><code>banira test</code></a> mounts every custom element it finds and asserts the tag registers
and upgrades — no per-component test code, and it exits non-zero on failure so it drops straight into CI.</p>
${code('test', ['banira test src/*.ts'])}

<h2 id="next">Next steps</h2>
<div class="next-grid">
  <a class="next-card" href="/docs/the-toolchain/"><span class="k">guide</span><div class="t">The toolchain</div><div class="d">How compile, manifest, doc and types fit together.</div></a>
  <a class="next-card" href="/docs/authoring-components/"><span class="k">guide</span><div class="t">Authoring components</div><div class="d">The jsdoc tags banira reads to build the manifest.</div></a>
  <a class="next-card" href="/cli/"><span class="k">reference</span><div class="t">CLI commands</div><div class="d">Every command, flag and example.</div></a>
</div>
`,
  },

  {
    slug: 'the-toolchain',
    label: 'The toolchain',
    title: 'The toolchain — banira.js',
    desc: 'How banira turns one component source file into a manifest, types, editor data and docs.',
    sub: 'One source file is the input; the Custom Elements Manifest is the hub everything else is derived from.',
    body: `
<h2 id="one-source">One source, many artifacts</h2>
<p>You write a vanilla custom element. banira reads it once into a <strong>Custom Elements Manifest</strong>
(<code>custom-elements.json</code>) — the ecosystem-standard descriptor — and every other artifact is derived from that
single source of truth, so they never drift apart.</p>
<ul>
  <li><strong>The manifest</strong> — <a href="/cli/manifest/"><code>banira manifest</code></a> — IDE autocomplete, Storybook controls, template type-checking.</li>
  <li><strong>Typings</strong> — <a href="/cli/types/"><code>banira types</code></a> — a <code>.d.ts</code> augmenting <code>HTMLElementTagNameMap</code>.</li>
  <li><strong>Editor data</strong> — <a href="/cli/editor-data/"><code>banira editor-data</code></a> — VS Code custom-data and JetBrains web-types.</li>
  <li><strong>Docs</strong> — <a href="/cli/doc/"><code>banira doc</code></a> — an HTML page with summary, demos and a full API reference.</li>
</ul>

<h2 id="pipeline">The generate pipeline</h2>
<p>A typical project regenerates everything from source in one pass:</p>
${code('generate everything', [
  'banira manifest src/*.ts        -o custom-elements.json',
  'banira types    src/*.ts        -o dist/elements.d.ts',
  'banira doc      src/my-button.ts -o docs/my-button.html',
], { prompt: true })}

<h2 id="library">The same thing, as a library</h2>
<p>Everything the CLI does is available as typed exports, so you can wire banira into your own scripts and build steps.</p>
${code('library', [
  "import { ManifestGenerator, toTypeDefinitions, DocGen } from 'banira';",
  '',
  "const manifest = new ManifestGenerator(['src/my-button.ts']).generate();",
  'const dts = toTypeDefinitions(manifest);',
  "const page = await new DocGen('my-button').generate('src/my-button.ts');",
], { prompt: false })}
<div class="callout">The full set of exports — <code>Compiler</code>, <code>ResultAnalyzer</code>, <code>TestHelper</code>,
<code>manifestToMarkdown</code>, <code>validateManifest</code>, <code>diffManifests</code> and more — is documented in the
<a href="/api/">API reference</a>.</div>

<h2 id="dev">Develop and ship</h2>
<p>While authoring, <a href="/cli/dev/"><code>banira dev</code></a> gives you compile-on-save with live reload. For
release, <a href="/cli/diff/"><code>banira diff</code></a> compares two manifests and suggests a semver bump — see
<a href="/docs/ci-and-release/">CI &amp; release</a>.</p>
`,
  },

  {
    slug: 'authoring-components',
    label: 'Authoring components',
    title: 'Authoring components — banira.js',
    desc: 'The jsdoc tags and conventions banira reads to build a complete manifest from a vanilla component.',
    sub: 'banira reads ordinary class members and a handful of jsdoc tags — no decorators, no base class.',
    body: `
<h2 id="from-code">Read straight from the code</h2>
<p>Most of the manifest comes from the platform itself, with no annotation required:</p>
<ul>
  <li><strong>Attributes</strong> — from <code>static observedAttributes</code>.</li>
  <li><strong>Properties &amp; methods</strong> — from public class members.</li>
  <li><strong>Events</strong> — from <code>new CustomEvent(...)</code> in the source.</li>
</ul>

<h2 id="tags">The jsdoc tags</h2>
<p>Slots, CSS parts and CSS custom properties aren't visible from the runtime shape, so banira reads them from class
jsdoc tags:</p>
<div class="table-wrap"><table class="opt">
  <thead><tr><th>Tag</th><th>Describes</th></tr></thead>
  <tbody>
    <tr><td class="k">@slot</td><td>A named (or default) slot the component projects into.</td></tr>
    <tr><td class="k">@csspart</td><td>A <code>::part()</code> exposed for external styling.</td></tr>
    <tr><td class="k">@cssprop</td><td>A CSS custom property the component reads.</td></tr>
    <tr><td class="k">@fires</td><td>An event the component dispatches.</td></tr>
  </tbody>
</table></div>

<h2 id="example">A worked example</h2>
${code('src/my-button.ts', [
  '/**',
  ' * @element my-button',
  ' * @csspart button - the inner button element',
  ' * @cssprop --my-button-radius - corner radius',
  ' * @fires click - when the button is activated',
  ' */',
  'export class MyButton extends HTMLElement {',
  "  static observedAttributes = ['variant', 'size'];",
  '  /* … */',
  '}',
  "customElements.define('my-button', MyButton);",
], { prompt: false })}

<h2 id="visibility">Deprecation &amp; visibility</h2>
<p>Members marked <code>@deprecated</code> carry their note through into the manifest and the generated docs. Members
marked <code>@internal</code> or <code>@ignore</code> are omitted entirely — handy for keeping implementation details out
of the public API surface.</p>

<div class="callout"><strong>Tip.</strong> Run <a href="/cli/manifest/"><code>banira manifest --validate</code></a> to check the
generated manifest against the CEM 2.1.0 shape, and <a href="/cli/doc/"><code>banira doc</code></a> to eyeball how the
tags render in a real reference page.</div>
`,
  },

  {
    slug: 'mcp-server',
    label: 'MCP server',
    title: 'MCP server — banira.js',
    desc: 'Expose banira to AI coding assistants over the Model Context Protocol — typed component data and a real verify loop, so the agent stops guessing.',
    sub: 'Run banira as an MCP server so an AI assistant introspects, verifies and scaffolds your components against real data — not hallucinated APIs.',
    body: `
<h2 id="why">Why an MCP server</h2>
<p>AI coding assistants are good at reading your files but bad at two things: they <strong>hallucinate component APIs</strong>
(attributes, events, slots that don't exist), and they write generic, framework-shaped code instead of your toolchain's
conventions. banira already solves the data side — its <a href="/cli/manifest/">manifest</a> is structured, typed metadata,
and its compiler and test helper produce real diagnostics. The
<a href="https://modelcontextprotocol.io/">Model Context Protocol</a> exposes all of that to the agent: <strong>typed data</strong>
to kill hallucination, and a <strong>verify loop</strong> — compile and actually mount the component — to check the agent's work.</p>

<h2 id="setup">Add it to your client</h2>
<p>The server runs as a local stdio process — no hosted service, nothing leaves your machine. Point any MCP client at it:</p>
${code('mcp client config', [
  '{',
  '  "mcpServers": {',
  '    "banira": { "command": "npx", "args": ["-y", "banira", "mcp"] }',
  '  }',
  '}',
], { prompt: false })}
<p>Or run it directly and explore it with the official
<a href="https://github.com/modelcontextprotocol/inspector">MCP Inspector</a>:</p>
${code('inspect', ['npx @modelcontextprotocol/inspector npx banira mcp'])}

<h2 id="tools">Tools</h2>
<p>Ten tools across four groups. Introspection and guidance are read-only; compile/verify and docs do the work.</p>
<div class="table-wrap"><table class="opt">
  <thead><tr><th>Tool</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td class="k">get_component_manifest</td><td>The full Custom Elements Manifest for the given file(s).</td></tr>
    <tr><td class="k">get_component_api</td><td>A compact typed view of one component — attributes, properties, methods, events, slots, parts, custom properties.</td></tr>
    <tr><td class="k">list_components</td><td>Every custom element in a file or directory, with a summary and per-feature counts.</td></tr>
    <tr><td class="k">get_component_demo</td><td>A component's <code>@demo</code> blocks as structured <code>{ language, code }</code>.</td></tr>
    <tr><td class="k">check_component</td><td>Type-check in memory (no files written) and return structured diagnostics, so the agent can self-correct.</td></tr>
    <tr><td class="k">compile_component</td><td>Compile to browser-ready ES modules, writing <code>.js</code>/<code>.js.map</code>. <span class="dim">(read-only mode omits it)</span></td></tr>
    <tr><td class="k">test_component</td><td>Mount the component (JSDOM by default) and report whether it registers and upgrades; optional real-browser run.</td></tr>
    <tr><td class="k">generate_docs</td><td>Produce the HTML documentation page as a string.</td></tr>
    <tr><td class="k">get_authoring_guidelines</td><td>banira's conventions — the jsdoc tag contract and per-variant starter components.</td></tr>
    <tr><td class="k">scaffold_component</td><td>Generate a banira-shaped starter component from a spec. <span class="dim">(read-only mode omits it)</span></td></tr>
  </tbody>
</table></div>

<h2 id="resources-prompts">Resources &amp; prompts</h2>
<p><strong>Resources</strong> — <code>resource://banira/components</code> (a manifest of every component in the workspace) and
<code>resource://banira/authoring-guide</code> (the conventions as Markdown). <strong>Prompts</strong> —
<code>implement_component_with_attributes</code>, <code>add_event_to_component</code>, and <code>document_and_verify</code>:
the composable <em>scaffold → check → test → docs</em> flow that makes MCP outperform plain retrieval.</p>

<h2 id="modes">Modes</h2>
<div class="table-wrap"><table class="opt">
  <thead><tr><th>Flag</th><th>Effect</th></tr></thead>
  <tbody>
    <tr><td class="k">--read-only</td><td>Expose only the read/analysis tools — no writes or scaffolding. Safe to leave always-on.</td></tr>
    <tr><td class="k">--local-only</td><td>Confine file access to the project and never emit network-reaching output (e.g. a CDN doc stylesheet).</td></tr>
    <tr><td class="k">-p, --project</td><td>A <code>tsconfig.json</code> whose options override the compiler defaults for the compile/analysis tools.</td></tr>
  </tbody>
</table></div>
<div class="callout">banira implements the MCP base protocol by hand — newline-delimited JSON-RPC 2.0, revision
<code>2025-11-25</code> — so the server adds no heavy dependencies on top of the toolchain you already have.</div>

<h2 id="next">Next steps</h2>
<div class="next-grid">
  <a class="next-card" href="/cli/mcp/"><span class="k">reference</span><div class="t">banira mcp</div><div class="d">The command, its flags and examples.</div></a>
  <a class="next-card" href="/docs/authoring-components/"><span class="k">guide</span><div class="t">Authoring components</div><div class="d">The jsdoc tags the tools surface to the agent.</div></a>
</div>
`,
  },

  {
    slug: 'ci-and-release',
    label: 'CI & release',
    title: 'CI & release — banira.js',
    desc: 'Use banira test as a CI gate, diff the manifest for a semver bump, and publish docs and packages.',
    sub: 'banira is built for CI: a smoke test that needs no per-component code, and a manifest diff that suggests the release type.',
    body: `
<h2 id="ci-gate">A CI smoke gate</h2>
<p><a href="/cli/test/"><code>banira test</code></a> compiles and mounts every element in your sources and asserts each one
registers and upgrades to an <code>HTMLElement</code>. It exits non-zero on the first failure, so it's a one-line CI gate:</p>
${code('.github/workflows/ci.yml', ['banira test src/*.ts'])}

<h2 id="semver">Diff for a semver bump</h2>
<p>Commit the generated <code>custom-elements.json</code>, then on each change compare the new manifest against the
committed baseline. <a href="/cli/diff/"><code>banira diff</code></a> classifies the change:</p>
<ul>
  <li>Removals or type changes → <strong>major</strong></li>
  <li>Additions → <strong>minor</strong></li>
  <li>Otherwise → <strong>patch</strong></li>
</ul>
${code('release gate', ['banira diff baseline/custom-elements.json custom-elements.json'])}
<div class="callout">Add <code>--json</code> to consume the diff programmatically in a release script.</div>

<h2 id="docs">Publish the docs</h2>
<p>This very site is built and deployed by GitHub Actions: the static pages plus a freshly generated
<a href="/api/">TypeDoc API reference</a>, published to GitHub Pages on every push to <code>main</code>. Per-component
reference pages come from <a href="/cli/doc/"><code>banira doc</code></a>, which defaults to PicoCSS but can inline a local
stylesheet for a fully offline page.</p>

<h2 id="npm">Publish the package</h2>
<p>Ship the compiled output plus the generated <code>.d.ts</code> from <a href="/cli/types/"><code>banira types</code></a>
so consumers get typed <code>querySelector</code>/<code>createElement</code> with no runtime import. banira itself
publishes to npm with provenance via Trusted Publishing (OIDC) — no long-lived token stored.</p>
`,
  },
];
