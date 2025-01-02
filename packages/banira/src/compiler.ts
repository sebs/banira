import { createProgram, CompilerOptions, Program, CustomTransformers, getPreEmitDiagnostics, Diagnostic, EmitResult, CompilerHost, ModuleKind, ModuleResolutionKind, ScriptTarget }  from "typescript";
import transformer from './transformer.js';
import { readFile } from "fs/promises";
import { createVirtualCompilerHost } from "./virtual-fs.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Loads TypeScript lib files
 * 
 * @link https://stackoverflow.com/questions/63145054/how-to-import-a-typescript-file-as-a-library
 * @returns An object containing the contents of the lib files
 */
const loadTypeScriptLibFiles = async () => {
    const tsPath = await import.meta.resolve('typescript');
    const tsLibPath = resolve(dirname(fileURLToPath(tsPath)), '');
    
    const libFilePaths = {
        'lib.es2015.d.ts': resolve(tsLibPath, 'lib.es2015.d.ts'),
        'lib.dom.d.ts': resolve(tsLibPath, 'lib.dom.d.ts'),
        'lib.es5.d.ts': resolve(tsLibPath, 'lib.es5.d.ts'),
    };

    const fileContents = await Promise.all(
        Object.entries(libFilePaths).map(async ([fileName, filePath]) => {
            const content = await readFile(filePath, 'utf-8');
            return [fileName, content] as const;
        })
    );

    return Object.fromEntries(fileContents);
};

/**
 * Result of a TypeScript compilation process
 * 
 * @interface CompilerResult
 * @property {Program} program - The TypeScript Program instance used for compilation
 * @property {EmitResult} emitResult - The result of the emit process, including any diagnostics
 * @property {readonly Diagnostic[]} diagnostics - Array of diagnostics from the compilation process
 * @property {readonly Diagnostic[]} preEmitDiagnostics - Array of diagnostics collected before emit
 * 
 * @example
 * ```typescript
 * const compiler = new Compiler(['src/file.ts'], options);
 * const result = compiler.emit();
 * 
 * if (result.diagnostics.length > 0) {
 *   console.log('Compilation had diagnostics:', result.diagnostics);
 * }
 * ```
 */
export interface CompilerResult {
    program: Program;
    emitResult: EmitResult;
    diagnostics: readonly Diagnostic[];
    preEmitDiagnostics: readonly Diagnostic[];
}

/**
 * Compiler class for compiling TypeScript files
 * 
 * @remarks
 * This class provides functionality to compile TypeScript files using either
 * the standard filesystem or a virtual filesystem (memfs).
 * 
 * @example
 * ```typescript
 * // Using standard filesystem
 * const compiler = new Compiler(['src/file.ts'], { outDir: 'dist' });
 * compiler.emit();
 * 
 * // Using virtual filesystem
 * const compiler = await Compiler.withVirtualFs(['src/file.ts'], { outDir: 'dist' });
 * compiler.emit();
 * ```
 */
export class Compiler {
    /**
     * Array of file paths to compile
     */
    public readonly fileNames: string[];

    /**
     * TypeScript compiler options
     */
    public readonly options: CompilerOptions;

    /**
     * Default transformers for the compiler
     */
    public readonly defaultTransformers: CustomTransformers;

    /**
     * Compiler host
     */
    public readonly host?: CompilerHost;

    /**
     * Default compiler options for the TypeScript compiler
     */
    public static DEFAULT_COMPILER_OPTIONS: CompilerOptions = {
        target: ScriptTarget.ES2015,
        module: ModuleKind.ES2015,
        outDir: './dist',
        moduleResolution: ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
        noEmitOnError: false,
        lib: [
            "lib.es2015.d.ts",
            "lib.dom.d.ts",
            "lib.es5.d.ts"
        ]
    };

    /**
     * Creates a new Compiler instance
     * 
     * @param fileNames - Array of file paths to compile
     * @param options - TypeScript compiler options
     * @param host - Compiler host
     */
    constructor(fileNames: string[], options: CompilerOptions, host?: CompilerHost) {
        this.fileNames = fileNames;
        this.options = options;
        this.host = host;
        this.defaultTransformers = {
            after: [transformer()]
        }
    }

    /**
     * Creates a Compiler instance that uses a virtual filesystem
     * 
     * @param fileNames - Array of file paths to compile
     * @param options - TypeScript compiler options
     * @returns A Promise that resolves to a new Compiler instance
     */
    static async withVirtualFs(fileNames: string[], options: CompilerOptions): Promise<Compiler> {
        // Load source files
        const sourceFiles = await Promise.all(
            fileNames.map(async (fileName) => {
                const content = await readFile(fileName, 'utf-8');
                return [fileName, content] as const;
            })
        );

        // Load TypeScript lib files
        const libFiles = await loadTypeScriptLibFiles();

        // Combine source files and lib files
        const files = { ...Object.fromEntries(sourceFiles), ...libFiles };

        const host = createVirtualCompilerHost({ 
            files, 
            cwd: process.cwd()
        });
        return new Compiler(fileNames, options, host);
    }

    /**
     * Emits the compiled output
     * 
     * @param outDir - Output directory
     * @returns An object containing the emit result and any diagnostics
     */
    emit(outDir?: string): CompilerResult {
        const options = outDir ? { ...this.options, outDir } : this.options;
        const program: Program = createProgram(this.fileNames, options, this.host);
        const emitResult = program.emit(undefined, undefined, undefined, undefined, this.defaultTransformers);

        const { diagnostics } = emitResult;
        const preEmitDiagnostics = getPreEmitDiagnostics(program);

        return {
            program,
            emitResult,
            diagnostics,
            preEmitDiagnostics
        }
    }
}