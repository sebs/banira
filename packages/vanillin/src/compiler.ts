import { createProgram, CompilerOptions, Program, CustomTransformers, getPreEmitDiagnostics, Diagnostic, EmitResult, CompilerHost }  from "typescript";
import transformer from './transformer.js';
import { readFileSync } from "fs";
import { createVirtualCompilerHost } from "./virtual-fs.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const loadTypeScriptLibFiles = async () => {
    const tsPath = await import.meta.resolve('typescript');
    const tsLibPath = resolve(dirname(fileURLToPath(tsPath)), '');
    const libFiles = {
        'lib.es2015.d.ts': readFileSync(resolve(tsLibPath, 'lib.es2015.d.ts'), 'utf-8'),
        'lib.dom.d.ts': readFileSync(resolve(tsLibPath, 'lib.dom.d.ts'), 'utf-8'),
        'lib.es5.d.ts': readFileSync(resolve(tsLibPath, 'lib.es5.d.ts'), 'utf-8'),
    };
    return libFiles;
};

export interface CompilerResult {
    program: Program;
    emitResult: EmitResult;
    diagnostics: readonly Diagnostic[];
    preEmitDiagnostics: readonly Diagnostic[];
}

export class Compiler {
    public readonly fileNames: string[];
    public readonly options: CompilerOptions;
    public readonly defaultTransformers: CustomTransformers;
    public readonly host?: CompilerHost;

    constructor(fileNames: string[], options: CompilerOptions, host?: CompilerHost) {
        this.fileNames = fileNames;
        this.options = options;
        this.host = host;
        this.defaultTransformers = {
            after: [transformer()]
        }
    }

    static async withVirtualFs(fileNames: string[], options: CompilerOptions): Promise<Compiler> {
        // Load source files
        const sourceFiles = fileNames.reduce((acc, fileName) => {
            acc[fileName] = readFileSync(fileName, 'utf-8');
            return acc;
        }, {} as { [path: string]: string });

        // Load TypeScript lib files
        const libFiles = await loadTypeScriptLibFiles();

        // Combine source files and lib files
        const files = { ...sourceFiles, ...libFiles };

        const host = createVirtualCompilerHost({ 
            files, 
            cwd: process.cwd()
        });
        return new Compiler(fileNames, options, host);
    }

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