#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compile } from './actions/compile.js';
import { doc } from './actions/doc.js';
import { manifest } from './actions/manifest.js';
import { watch } from './actions/watch.js';
import { serve } from './actions/serve.js';

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
  .option('-o, --outDir <path>', 'Output directory')
  .action(compile);

program
  .command('doc')
  .description('Generate an HTML documentation page (with API reference) for a component')
  .argument('<file>', 'TypeScript file to document')
  .option('-o, --output <path>', 'Write the doc page to a file instead of stdout')
  .action(doc);

program
  .command('manifest')
  .description('Generate a Custom Elements Manifest (custom-elements.json)')
  .argument('<files...>', 'Component source files to analyze')
  .option('-o, --output <path>', 'Write the manifest to a file instead of stdout')
  .action(manifest);

program
  .command('watch')
  .description('Recompile components whenever their source changes')
  .argument('<files...>', 'TypeScript files to compile')
  .option('-p, --project <path>', 'Path to tsconfig.json')
  .option('-o, --outDir <path>', 'Output directory')
  .action((files, options) => { watch(files, options); });

program
  .command('serve')
  .description('Serve a directory over HTTP with live reload')
  .argument('[root]', 'Directory to serve', '.')
  .option('-p, --port <number>', 'Port to listen on', '8080')
  .action((root, options) => { serve(root, options); });

program.parse();
