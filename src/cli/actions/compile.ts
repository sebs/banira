import { Compiler, ResultAnalyzer } from '../../index.js';
import * as ts from 'typescript';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

export interface CompileOptions {
  project?: string;
  outDir?: string;
}

export interface CompileOutcome {
  ok: boolean;
  errors: ts.Diagnostic[];
  outputs: string[];
}

/**
 * Resolves the TypeScript compiler options for a CLI compile, starting from the
 * library defaults and layering on a `--project` tsconfig and `--outDir`.
 *
 * @throws Error if the tsconfig is missing or cannot be parsed.
 */
export function resolveCompilerOptions(options: CompileOptions): ts.CompilerOptions {
  // Start from the library defaults so that, without --project, output still
  // has a defined module/target/lib/outDir instead of bare tsc defaults.
  let compilerOptions: ts.CompilerOptions = { ...Compiler.DEFAULT_COMPILER_OPTIONS };

  if (options.project) {
    const configPath = resolve(options.project);
    if (!existsSync(configPath)) {
      throw new Error(`tsconfig.json not found at ${configPath}`);
    }

    const configFile = readFileSync(configPath, 'utf8');
    const { config } = ts.parseConfigFileTextToJson(configPath, configFile);
    const result = ts.convertCompilerOptionsFromJson(config.compilerOptions, dirname(configPath));

    if (result.errors.length) {
      const messages = result.errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n');
      throw new Error(`Error parsing tsconfig.json:\n${messages}`);
    }

    // Project options override the defaults.
    compilerOptions = { ...compilerOptions, ...result.options };
  }

  if (options.outDir) {
    compilerOptions.outDir = resolve(options.outDir);
  }

  return compilerOptions;
}

/**
 * Compiles the given files and returns the outcome. Pure: it neither logs nor
 * exits, so it can be reused by the one-shot `compile` command and the `watch`
 * loop alike.
 */
export function compileFiles(files: string[], options: CompileOptions): CompileOutcome {
  const compilerOptions = resolveCompilerOptions(options);
  const compiler = new Compiler(files, compilerOptions);
  const analyzer = new ResultAnalyzer(compiler.emit());
  const diagnostics = analyzer.diag();
  return { ok: !diagnostics.hasErrors, errors: diagnostics.errors, outputs: analyzer.outputFiles };
}

/** Formats compiler error diagnostics as `file (line,col): message` lines. */
export function formatErrors(errors: ts.Diagnostic[]): string {
  return errors
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
        return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
      }
      return message;
    })
    .join('\n');
}

export const compile = async (files: string[], options: CompileOptions) => {
  try {
    const { ok, errors, outputs } = compileFiles(files, options);

    if (!ok) {
      console.error('Compilation errors:');
      console.error(formatErrors(errors));
      process.exit(1);
    }

    console.log('Compilation complete');
    if (outputs.length > 0) {
      console.log('Generated files:');
      outputs.forEach((file) => console.log(`  ${file}`));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
};
