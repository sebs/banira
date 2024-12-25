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
  .action(async (files: string[], options: { project?: string, outDir?: string }) => {
    try {
      // Load compiler options
      let compilerOptions: ts.CompilerOptions = {};
      let configDir = process.cwd();
      
      if (options.project) {
        const configPath = resolve(process.cwd(), options.project);
        configDir = dirname(configPath);
        
        if (!existsSync(configPath)) {
          console.error(`Error: tsconfig.json not found at ${configPath}`);
          process.exit(1);
        }

        const configFile = readFileSync(configPath, 'utf8');
        const { config } = ts.parseConfigFileTextToJson(configPath, configFile);
        const { options: parsedOptions } = ts.convertCompilerOptionsFromJson(
          config.compilerOptions,
          configDir
        );

        compilerOptions = parsedOptions;
      }

      // Set rootDir to the config directory or src subdirectory if it exists
      const potentialSrcDir = resolve(configDir, 'src');
      compilerOptions.rootDir = existsSync(potentialSrcDir) ? potentialSrcDir : configDir;

      // Override outDir if specified
      if (options.outDir) {
        compilerOptions.outDir = resolve(process.cwd(), options.outDir);
      }

      // Resolve file paths
      const resolvedFiles = files.map(file => resolve(process.cwd(), file));

      // Compile files
      const result = compile(resolvedFiles, compilerOptions);
      
      if (result.diagnostics && result.diagnostics.length > 0) {
        result.diagnostics.forEach((diagnostic: ts.Diagnostic) => {
          if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
            console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${diagnostic.messageText}`);
          } else {
            console.error(diagnostic.messageText);
          }
        });
        process.exit(1);
      }

      console.log('Compilation completed successfully');
    } catch (error) {
      console.error('Compilation failed:', error);
      process.exit(1);
    }
  });

program.parse();
