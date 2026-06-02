#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compile } from './actions/compile.js';
import { doc } from './actions/doc.js';

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
  .description('Generate documentation for a TypeScript file')
  .argument('<file>', 'TypeScript file to document')
  .option('-o, --output <path>', 'Write the doc page to a file instead of stdout')
  .action(doc);

program.parse();
