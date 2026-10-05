/**
 * Bundles a TypeScript component and its LOCAL module graph (sibling/relative
 * imports) into a single self-contained classic script.
 *
 * jsdom can execute classic scripts but not ES-module imports, and a one-file
 * compile can't see a component's imports. This compiles the entry + everything
 * it imports (the TS Program already follows the import graph) to ES modules
 * with the same CSS/HTML import lowering as `Compiler`, converts each module to
 * CommonJS, then concatenates them behind a tiny registry + `require` shim and
 * runs the entry — so {@link TestHelper} can mount components that import other
 * modules, stylesheets and templates.
 *
 * Only the local graph is bundled. Bare/external (npm) imports are left as
 * `require('pkg')` and throw a clear error at runtime if reached.
 */
import { createProgram, transpileModule, ModuleKind, ModuleResolutionKind, type CompilerOptions } from 'typescript';
import { resolve, sep } from 'path';
import { realpathSync, readFileSync } from 'fs';
import { lowerCssImports } from './css-transformer.js';
import { lowerHtmlImports } from './html-transformer.js';

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

/** True when `p` (already real) is `root` or inside it. */
function isInside(p: string, root: string): boolean {
    return p === root || p.startsWith(root + sep);
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
    // Emit ES modules first so the CSS/HTML import lowering (an `after`
    // transformer) sees `import` declarations, exactly as in `Compiler`; each
    // module is converted to CommonJS below. (Lowering during a CommonJS emit
    // can't work: TS would still rewrite references to the removed import.)
    const options: CompilerOptions = {
        ...rest,
        module: ModuleKind.ESNext,
        moduleResolution: ModuleResolutionKind.Bundler,
        declaration: false,
        sourceMap: false,
        inlineSourceMap: false,
        importHelpers: false, // inline helpers per-module → no tslib require
    };
    const cjsOptions: CompilerOptions = { ...options, module: ModuleKind.CommonJS };

    const program = createProgram([entry], options);

    // Hold the bundled graph to a root: every non-declaration source the program
    // pulled in (the entry plus its local imports) must stay inside it, so a
    // relative import can't drag out-of-tree source into the bundle.
    const root = bundleOptions.confineToRoot ? realPathOrSelf(resolve(bundleOptions.confineToRoot)) : undefined;
    if (root) {
        for (const sf of program.getSourceFiles()) {
            if (sf.isDeclarationFile) continue; // skip lib + .d.ts
            if (!isInside(realPathOrSelf(sf.fileName), root)) {
                throw new Error(`bundleModule: refusing to bundle "${sf.fileName}" outside ${root} (--local-only).`);
            }
        }
    }

    // Inlined stylesheets/templates are held to the same root.
    const readAsset = (absolutePath: string): string | undefined => {
        if (root && !isInside(realPathOrSelf(absolutePath), root)) {
            throw new Error(`bundleModule: refusing to bundle "${absolutePath}" outside ${root} (--local-only).`);
        }
        try {
            return readFileSync(absolutePath, 'utf8');
        } catch {
            return undefined;
        }
    };

    const modules = new Map<string, string>();
    // Custom writeFile captures emitted JS in memory — nothing touches disk.
    program.emit(
        undefined,
        (outPath, data) => {
            if (!outPath.endsWith('.js')) return;
            const cjs = transpileModule(data, { compilerOptions: cjsOptions, fileName: outPath }).outputText;
            modules.set(toId(outPath), cjs);
        },
        undefined,
        false,
        { after: [lowerCssImports({ readCss: readAsset }), lowerHtmlImports({ readHtml: readAsset })] }
    );

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
