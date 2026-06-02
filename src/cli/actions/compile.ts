import { Compiler, ResultAnalyzer } from '../../index.js';
import * as ts from 'typescript';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';


export const compile = async (files: string[], options: { project?: string; outDir?: string }) => {
  try {
    // Start from the library defaults so that, without --project, output still
    // has a defined module/target/lib/outDir instead of bare tsc defaults.
    let compilerOptions: ts.CompilerOptions = { ...Compiler.DEFAULT_COMPILER_OPTIONS };

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

      // Project options override the defaults.
      compilerOptions = { ...compilerOptions, ...result.options };
    }

    if (options.outDir) {
      compilerOptions.outDir = resolve(options.outDir);
    }

    const compiler = new Compiler(files, compilerOptions);
    const result = compiler.emit();
    const analyzer = new ResultAnalyzer(result);

    // Check for compilation errors
    const diagnostics = analyzer.diag();
    if (diagnostics.hasErrors) {
      console.error('Compilation errors:');
      diagnostics.errors.forEach(diagnostic => {
        if (diagnostic.file) {
          const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
          console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        } else {
          console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        }
      });
      process.exit(1);
    }

    console.log('Compilation complete');
    if (analyzer.outputFiles.length > 0) {
      console.log('Generated files:');
      analyzer.outputFiles.forEach(file => console.log(`  ${file}`));
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}