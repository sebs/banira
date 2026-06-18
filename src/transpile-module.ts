import { transpileModule, type CompilerOptions } from 'typescript';
import transformer from './transformer.js';
import { Compiler } from './compiler.js';

/**
 * Transpiles a single TypeScript source string to a browser-ready ES module:
 * type annotations stripped and relative imports rewritten with a `.js`
 * extension (via the shared {@link transformer}), without type-checking or
 * touching disk. This is the per-file transform behind `banira serve --ts`,
 * producing the same module shape as a full `banira compile` of one file.
 */
export function transpileToEsm(
    source: string,
    fileName: string = 'module.ts',
    options: CompilerOptions = Compiler.DEFAULT_COMPILER_OPTIONS
): string {
    const result = transpileModule(source, {
        compilerOptions: options,
        fileName,
        transformers: { after: [transformer()] },
    });
    return result.outputText;
}
