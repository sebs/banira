import { transpileModule, type CompilerOptions } from 'typescript';
import transformer from './transformer.js';
import { Compiler } from './compiler.js';
import { lowerCssImports } from './css-transformer.js';
import { lowerHtmlImports } from './html-transformer.js';

/**
 * Transpiles a single TypeScript source string to a browser-ready ES module:
 * type annotations stripped, relative CSS/HTML imports lowered to constructable
 * stylesheets / templates (as in `Compiler`), and relative imports rewritten
 * with a `.js` extension (via the shared {@link transformer}), without
 * type-checking. This is the per-file transform behind `banira serve --ts`,
 * producing the same module shape as a full `banira compile` of one file.
 *
 * The output carries an inline source map (with the original TypeScript
 * embedded) so breakpoints in devtools resolve to the `.ts` — there is no
 * separate `.map` file to serve. See #47.
 *
 * @param readAsset Reads an imported `.css`/`.html` file by absolute path, or
 *   returns `undefined` to leave the import untouched. Defaults to a disk read
 *   relative to `fileName`; `serve` passes one confined to the served root.
 */
export function transpileToEsm(
    source: string,
    fileName: string = 'module.ts',
    options: CompilerOptions = Compiler.DEFAULT_COMPILER_OPTIONS,
    readAsset?: (absolutePath: string) => string | undefined
): string {
    const result = transpileModule(source, {
        // Inline the map + sources into the served module. `inlineSourceMap` and
        // the file-emitting `sourceMap` are mutually exclusive, so disable the latter.
        compilerOptions: { ...options, sourceMap: false, inlineSourceMap: true, inlineSources: true },
        fileName,
        transformers: {
            after: [
                lowerCssImports(readAsset ? { readCss: readAsset } : {}),
                lowerHtmlImports(readAsset ? { readHtml: readAsset } : {}),
                transformer(),
            ],
        },
    });
    return result.outputText;
}
