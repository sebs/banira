#!/usr/bin/env node

import { Command } from 'commander';
import { compile } from 'vanillin';
import * as ts from 'typescript';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

const program = new Command();

program
  .name('vanillin')
  .description('CLI tool for Vanillin.js')
  .version('0.1.0');

program
  .command('compile')
  .description('Compile TypeScript files using Vanillin')
  .argument('<files...>', 'TypeScript files to compile')
  .option('-p, --project <path>', 'Path to tsconfig.json')
  .option('-o, --outDir <path>', 'Output directory')
  .action(async (files: string[], options: { project?: string; outDir?: string }) => {
    try {
      let compilerOptions: ts.CompilerOptions = {};

      if (options.project) {
        const configPath = resolve(options.project);
        if (!existsSync(configPath)) {
          console.error(`Error: tsconfig.json not found at ${configPath}`);
          process.exit(1);
        }

        const configFile = readFileSync(configPath, 'utf8');
        const { config } = ts.parseConfigFileTextToJson(configPath, configFile);
        const result = ts.convertCompilerOptionsFromJson(
          config.compilerOptions,
          dirname(configPath)
        );

        if (result.errors.length) {
          console.error('Error parsing tsconfig.json:', result.errors);
          process.exit(1);
        }

        compilerOptions = result.options;
      }

      if (options.outDir) {
        compilerOptions.outDir = resolve(options.outDir);
      }

      compile(files, compilerOptions);
      console.log('Compilation complete');
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });

program.parse();
