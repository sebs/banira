#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compile } from './actions/compile.js';
import { doc } from './actions/doc.js';
import { manifest } from './actions/manifest.js';
import { tokens } from './actions/tokens.js';
import { tokensCss } from './actions/tokens-css.js';
import { theme } from './actions/theme.js';
import { stories } from './actions/stories.js';
import { lint } from './actions/lint.js';
import { editorData } from './actions/editor-data.js';
import { types } from './actions/types.js';
import { diff } from './actions/diff.js';
import { watch } from './actions/watch.js';
import { serve } from './actions/serve.js';
import { dev } from './actions/dev.js';
import { test } from './actions/test.js';
import { init } from './actions/init.js';
import { prerender } from './actions/prerender.js';

// Read our own version from package.json at runtime. The CLI is built to
// dist/cli/index.js, so the package root is two levels up.
const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')
);

const program = new Command();

program
  .name('banira')
  .description('CLI tool for banira.js')
  .version(pkg.version);

program
  .command('compile')
  .description('Compile TypeScript files using banira')
  .argument('<files...>', 'TypeScript files to compile')
  .option('-p, --project <path>', 'Path to tsconfig.json')
  .option('-o, --output <path>', 'Output directory')
  .option('--import-map [path]', 'Also emit an import map (esm.sh) for bare imports; optional output path')
  .option('--optimize-css', 'Run inlined CSS through lightningcss (lower nesting, minify)')
  .option('--no-source-map', 'Do not emit source maps (which embed the original TypeScript)')
  .action((files, options) =>
    compile(files, {
      project: options.project,
      outDir: options.output,
      importMap: options.importMap,
      optimizeCss: options.optimizeCss,
      sourceMap: options.sourceMap,
    })
  );

program
  .command('doc')
  .description('Generate an HTML documentation page (with API reference) for a component')
  .argument('<file>', 'TypeScript file to document')
  .option('-o, --output <path>', 'Write the doc page to a file instead of stdout')
  .option('--script-src <path>', 'Component module src used in the page (default ./dist/<tag>.js)')
  .option('--stylesheet <value>', "Page stylesheet: a URL, a local .css file to inline, or 'none' (default: PicoCSS CDN)")
  .action(doc);

program
  .command('manifest')
  .description('Generate a Custom Elements Manifest (custom-elements.json)')
  .argument('<files...>', 'Component source files to analyze')
  .option('-o, --output <path>', 'Write the output to a file instead of stdout')
  .option('--md', 'Emit Markdown API documentation instead of JSON')
  .option('--validate', 'Validate the generated manifest and print a report (exit 1 on errors)')
  .option('--link-package', "Point the nearest package.json's customElements field at the written manifest")
  .action((files, options) =>
    manifest(files, { output: options.output, md: options.md, validate: options.validate, linkPackage: options.linkPackage })
  );

program
  .command('tokens')
  .description('Generate a theming / design-tokens document from the components CSS custom properties')
  .argument('<files...>', 'Component source files to analyze')
  .option('-o, --output <path>', 'Write the document to a file instead of stdout')
  .option('--title <title>', 'Document title (default: Design Tokens)')
  .action((files, options) => tokens(files, { output: options.output, title: options.title }));

program
  .command('tokens-css')
  .description('Compile a W3C Design Tokens (DTCG) tokens.json into :root CSS custom properties')
  .argument('<tokens.json>', 'DTCG design tokens document')
  .option('-o, --output <path>', 'Write the stylesheet to a file instead of stdout')
  .option('--selector <selector>', 'CSS selector for the custom properties (default :root)')
  .action((file, options) => tokensCss(file, { output: options.output, selector: options.selector }));

program
  .command('theme')
  .description('Scaffold a light/dark theme contract, a <theme-toggle> component, and a demo page')
  .argument('[dir]', 'Directory to scaffold into', '.')
  .option('--force', 'Overwrite existing files')
  .option('--tag <tag-name>', 'Tag name for the toggle component (default theme-toggle)')
  .option('--tokens <tokens.json>', 'Seed the light :root token set from a DTCG document')
  .action((dir, options) => theme(dir, { force: options.force, tag: options.tag, tokens: options.tokens }));

program
  .command('stories')
  .description('Generate Storybook CSF (*.stories.js) with argTypes from the components')
  .argument('<files...>', 'Component source files to analyze')
  .option('-o, --out-dir <dir>', 'Directory to write the stories to', '.')
  .option('--import-path <path>', 'Module imported per story so the element registers (default ./{tag}.js)')
  .action((files, options) => stories(files, { outDir: options.outDir, importPath: options.importPath }));

program
  .command('editor-data')
  .description('Generate editor IntelliSense data (VS Code custom-data + JetBrains web-types)')
  .argument('<files...>', 'Component source files to analyze')
  .option('-o, --out-dir <dir>', 'Directory to write the data files to', '.')
  .action((files, options) => editorData(files, { outDir: options.outDir }));

program
  .command('types')
  .description('Generate a .d.ts that types the custom elements (HTMLElementTagNameMap)')
  .argument('<files...>', 'Component source files to analyze')
  .option('-o, --output <path>', 'Write the .d.ts to a file instead of stdout')
  .option('--jsx', 'Also augment JSX.IntrinsicElements')
  .action((files, options) => types(files, { output: options.output, jsx: options.jsx }));

program
  .command('diff')
  .description('Diff two Custom Elements Manifest JSON files and suggest a semver bump')
  .argument('<baseline>', 'Baseline custom-elements.json')
  .argument('<current>', 'Current custom-elements.json')
  .option('--json', 'Emit the diff as JSON')
  .action((baseline, current, options) => diff(baseline, current, { json: options.json }));

program
  .command('watch')
  .description('Recompile components whenever their source changes')
  .argument('<files...>', 'TypeScript files to compile')
  .option('-p, --project <path>', 'Path to tsconfig.json')
  .option('-o, --output <path>', 'Output directory')
  .action((files, options) => { watch(files, { project: options.project, outDir: options.output }); });

program
  .command('dev')
  .description('Compile-on-change and serve with live reload in one command')
  .argument('<files...>', 'TypeScript files to compile')
  .option('-p, --project <path>', 'Path to tsconfig.json')
  .option('-o, --output <path>', 'Output directory')
  .option('-r, --root <path>', 'Directory to serve (defaults to the output dir, or .)')
  .option('--port <number>', 'Port to listen on', '8080')
  .option('--host <host>', 'Host/interface to bind (default 127.0.0.1; use 0.0.0.0 to expose)')
  .option('--ts', 'Serve TypeScript transpiled on the fly (no separate compile step)')
  .option('--hmr', 'Hot-swap custom elements in place instead of full-page reload')
  .option('--import-map', 'Inject a <script type="importmap"> (esm.sh) for bare imports into served HTML')
  .action((files, options) => {
    try {
      dev(files, {
        project: options.project,
        outDir: options.output,
        root: options.root,
        port: options.port,
        host: options.host,
        transformTs: options.ts,
        hmr: options.hmr,
        importMap: options.importMap,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Serve a directory over HTTP with live reload')
  .argument('[root]', 'Directory to serve', '.')
  .option('-p, --port <number>', 'Port to listen on', '8080')
  .option('--host <host>', 'Host/interface to bind (default 127.0.0.1; use 0.0.0.0 to expose on the network)')
  .option('--ts', 'Serve TypeScript transpiled on the fly (no separate compile step)')
  .option('--hmr', 'Hot-swap custom elements in place instead of full-page reload')
  .option('--import-map', 'Inject a <script type="importmap"> (esm.sh) for bare imports into served HTML')
  .action((root, options) => {
    try {
      serve(root, {
        port: options.port,
        host: options.host,
        transformTs: options.ts,
        hmr: options.hmr,
        importMap: options.importMap,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('lint')
  .description('Audit components against the Gold Standard Checklist + documentation coverage')
  .argument('<files...>', 'Component source files to lint')
  .option('--json', 'Emit findings as JSON')
  .option('--strict', 'Treat warnings as errors (exit 1 if any finding)')
  .option('--rules <ids>', 'Comma-separated rule ids to run (default: all)')
  .action((files, options) => lint(files, { json: options.json, strict: options.strict, rules: options.rules }));

program
  .command('test')
  .description('Manifest-driven smoke test: mount each element and assert it registers')
  .argument('<files...>', 'Component source files to test')
  .option('--reflection', 'Also check attribute↔property reflection round-trip (advisory warnings)')
  .option('--slots', 'Also assert declared @slots project and flag undeclared shadow slots (advisory)')
  .action((files, options) => test(files, { reflection: options.reflection, slots: options.slots }));

program
  .command('init')
  .description('Scaffold a starter vanilla web component (source + demo page)')
  .argument('<tag-name>', 'Custom element tag name (must contain a hyphen)')
  .argument('[dir]', 'Directory to scaffold into', '.')
  .option('--force', 'Overwrite existing files')
  .option('--form-associated', 'Scaffold a form-associated element (ElementInternals)')
  .option('--aria', 'Scaffold an ARIA role/state-reflecting element (ElementInternals)')
  .option('--hydrate', 'Scaffold a component that hydrates a prerendered Declarative Shadow DOM root')
  .action((tagName, dir, options) =>
    init(tagName, dir, {
      force: options.force,
      formAssociated: options.formAssociated,
      aria: options.aria,
      hydrate: options.hydrate,
    })
  );

program
  .command('prerender')
  .description('Render components to static HTML using Declarative Shadow DOM')
  .argument('<files...>', 'Component source files to prerender')
  .option('-o, --output <path>', 'Write the markup to a file instead of stdout')
  .action((files, options) => prerender(files, { output: options.output }));

program.parse();
