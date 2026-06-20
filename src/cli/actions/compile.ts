import { Compiler, ResultAnalyzer, isCssModuleNotFoundDiagnostic, buildImportMap, isBareSpecifier } from '../../index.js';
import * as ts from 'typescript';
import { readFileSync, existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname, join } from 'path';
import { action } from './run.js';

export interface CompileOptions {
  project?: string;
  outDir?: string;
  /**
   * Emit an import map for the components' bare imports. `true` writes
   * `import-map.json` (into `--output` when given, else the cwd); a string is
   * used as the output path. Bare specifiers are pinned to esm.sh at the
   * version declared in `package.json`.
   */
  importMap?: boolean | string;
  /** Run inlined CSS through lightningcss (flatten @import, lower nesting, minify). Optional dep. */
  optimizeCss?: boolean;
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
  const compiler = new Compiler(files, compilerOptions, undefined, options.optimizeCss ? { optimizeCss: true } : undefined);
  const analyzer = new ResultAnalyzer(compiler.emit());
  const diagnostics = analyzer.diag();
  // CSS imports are lowered to constructable stylesheets at emit; the
  // "Cannot find module './x.css'" type error they raise is expected, not a failure.
  const errors = diagnostics.errors.filter((d) => !isCssModuleNotFoundDiagnostic(d));
  return { ok: errors.length === 0, errors, outputs: analyzer.outputFiles };
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

/**
 * True for a TS2307 "Cannot find module 'X'" diagnostic where X is a bare
 * specifier. With `--import-map` such modules are resolved at runtime from a
 * CDN and are deliberately not installed, so the diagnostic is expected — the
 * same treatment {@link isCssModuleNotFoundDiagnostic} gives lowered CSS imports.
 */
function isBareModuleNotFoundDiagnostic(diagnostic: ts.Diagnostic): boolean {
  if (diagnostic.code !== 2307) return false;
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const match = /Cannot find module '([^']+)'/.exec(message);
  return match ? isBareSpecifier(match[1]!) : false;
}

export const compile = action('Compilation failed', async (files: string[], options: CompileOptions) => {
  const outcome = compileFiles(files, options);
  const outputs = outcome.outputs;
  // With --import-map, unresolved bare imports are expected (CDN-resolved at runtime).
  const errors = options.importMap
    ? outcome.errors.filter((d) => !isBareModuleNotFoundDiagnostic(d))
    : outcome.errors;
  const ok = errors.length === 0;

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

  if (options.importMap) {
    const map = buildImportMap(files, { recursive: true });
    const count = Object.keys(map.imports).length / 2; // bare + trailing-slash entry per package
    const defaultDir = options.outDir ? resolve(options.outDir) : process.cwd();
    const outPath =
      typeof options.importMap === 'string' ? resolve(options.importMap) : join(defaultDir, 'import-map.json');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
    console.log(`Import map written to ${outPath} (${count} package${count === 1 ? '' : 's'})`);
    const unpinned = Object.entries(map.imports).filter(([key, url]) => !key.endsWith('/') && !/@/.test(url.replace(/^https?:\/\//, '')));
    if (unpinned.length > 0) {
      console.log(`  Unpinned (no version in package.json): ${unpinned.map(([k]) => k).join(', ')}`);
    }
  }
});
