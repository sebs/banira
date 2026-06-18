#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compile } from './actions/compile.js';
import { doc } from './actions/doc.js';
import { manifest } from './actions/manifest.js';
import { editorData } from './actions/editor-data.js';
import { types } from './actions/types.js';
import { diff } from './actions/diff.js';
import { watch } from './actions/watch.js';
import { serve } from './actions/serve.js';
import { dev } from './actions/dev.js';
import { test } from './actions/test.js';

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
  .action((files, options) => compile(files, { project: options.project, outDir: options.output }));

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
  .action(manifest);

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
  .action((files, options) => {
    try {
      dev(files, {
        project: options.project,
        outDir: options.output,
        root: options.root,
        port: options.port,
        host: options.host,
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
  .action((root, options) => {
    try {
      serve(root, options);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Manifest-driven smoke test: mount each element and assert it registers')
  .argument('<files...>', 'Component source files to test')
  .action((files) => test(files));

program.parse();
