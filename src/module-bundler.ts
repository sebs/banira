/**
 * Bundles a TypeScript component and its LOCAL module graph (sibling/relative
 * imports) into a single self-contained classic script.
 *
 * jsdom can execute classic scripts but not ES-module imports, and a one-file
 * compile can't see a component's imports. This compiles the entry + everything
 * it imports (the TS Program already follows the import graph) to CommonJS, then
 * concatenates the modules behind a tiny registry + `require` shim and runs the
 * entry — so {@link TestHelper} can mount components that import other modules.
 *
 * Only the local graph is bundled. Bare/external (npm) imports are left as
 * `require('pkg')` and throw a clear error at runtime if reached.
 */
import { createProgram, ModuleKind, ModuleResolutionKind, type CompilerOptions } from 'typescript';
import { resolve, sep } from 'path';
import { realpathSync } from 'fs';

/** Normalize a filesystem path to a stable, forward-slash module id. */
function toId(p: string): string {
    return resolve(p).replace(/\\/g, '/');
}

/** Resolve through symlinks, falling back to the lexical path when it doesn't exist. */
function realPathOrSelf(p: string): string {
    try {
        return realpathSync(p);
    } catch {
        return p;
    }
}

/** Options controlling how {@link bundleModule} resolves the module graph. */
export interface BundleOptions {
    /**
     * Confine the bundled module graph to this directory: if the entry's local
     * imports pull in a source file outside `confineToRoot`, bundling throws
     * rather than inlining out-of-tree source. Used by the MCP `--local-only`
     * mount path so a component can't reach `../../secret.ts`. See
     * security-findings #22.
     */
    confineToRoot?: string;
}

/**
 * Compiles `fileName` and its local import graph into a single classic-script
 * string (an IIFE with a CommonJS module registry that executes the entry).
 *
 * @param fileName - Path to the entry TypeScript file.
 * @param compilerOptions - Base compiler options (module kind etc. are overridden).
 * @returns Self-contained JavaScript with no `import`/`export` statements.
 */
export function bundleModule(
    fileName: string,
    compilerOptions: CompilerOptions = {},
    bundleOptions: BundleOptions = {}
): string {
    const entry = toId(fileName);

    // Drop outDir so emitted paths mirror the source tree (keeps relative
    // `require` specifiers aligned with our module ids).
    const { outDir: _outDir, ...rest } = compilerOptions;
    const options: CompilerOptions = {
        ...rest,
        module: ModuleKind.CommonJS,
        moduleResolution: ModuleResolutionKind.Bundler,
        declaration: false,
        sourceMap: false,
        inlineSourceMap: false,
        importHelpers: false, // inline helpers per-module → no tslib require
    };

    const program = createProgram([entry], options);

    // Hold the bundled graph to a root: every non-declaration source the program
    // pulled in (the entry plus its local imports) must stay inside it, so a
    // relative import can't drag out-of-tree source into the bundle.
    if (bundleOptions.confineToRoot) {
        const root = realPathOrSelf(resolve(bundleOptions.confineToRoot));
        for (const sf of program.getSourceFiles()) {
            if (sf.isDeclarationFile) continue; // skip lib + .d.ts
            const real = realPathOrSelf(sf.fileName);
            if (real !== root && !real.startsWith(root + sep)) {
                throw new Error(`bundleModule: refusing to bundle "${sf.fileName}" outside ${root} (--local-only).`);
            }
        }
    }

    const modules = new Map<string, string>();
    // Custom writeFile captures emitted JS in memory — nothing touches disk.
    program.emit(undefined, (outPath, data) => {
        if (outPath.endsWith('.js')) modules.set(toId(outPath), data);
    });

    const entryOut = entry.replace(/\.tsx?$/i, '.js');
    if (!modules.has(entryOut)) {
        throw new Error(`bundleModule: no emitted output for entry "${fileName}"`);
    }

    const registry = [...modules.entries()]
        .map(([id, code]) => `${JSON.stringify(id)}: function (module, exports, require) {\n${code}\n}`)
        .join(',\n');

    return `(function () {
var __modules = {
${registry}
};
var __cache = {};
function __resolveFrom(fromId, spec) {
  if (spec.charAt(0) !== '.') return spec;
  var parts = fromId.split('/'); parts.pop();
  var segs = spec.split('/');
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    if (s === '' || s === '.') continue;
    if (s === '..') parts.pop(); else parts.push(s);
  }
  return parts.join('/');
}
function __require(id) {
  if (__cache[id]) return __cache[id].exports;
  var factory = __modules[id];
  if (!factory) throw new Error("Cannot find module '" + id + "' — TestHelper bundles local modules only (external/npm imports are not supported).");
  var module = { exports: {} };
  __cache[id] = module;
  factory(module, module.exports, function (spec) { return __require(__resolveFrom(id, spec)); });
  return module.exports;
}
__require(${JSON.stringify(entryOut)});
})();`;
}
