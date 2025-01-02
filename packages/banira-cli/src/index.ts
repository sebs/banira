#!/usr/bin/env node

import { Command } from 'commander';
import { compile } from './actions/compile.js';

const program = new Command();

program
  .name('banira')
  .description('CLI tool for banira.js')
  .version('0.1.0');

program
  .command('compile')
  .description('Compile TypeScript files using banira')
  .argument('<files...>', 'TypeScript files to compile')
  .option('-p, --project <path>', 'Path to tsconfig.json')
  .option('-o, --outDir <path>', 'Output directory')
  .action(compile);

program.parse();
