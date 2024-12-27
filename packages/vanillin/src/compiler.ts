import { createProgram, CompilerOptions, Program, CustomTransformers, getPreEmitDiagnostics, Diagnostic, EmitResult, CompilerHost }  from "typescript";
import transformer from './transformer.js';
import { readFileSync } from "fs";
import { createVirtualCompilerHost } from "./virtual-fs.js";

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
        // append .js to all imports
        this.defaultTransformers = {
            after: [transformer()]
        }
    }

    static withVirtualFs(fileNames: string[], options: CompilerOptions): Compiler {
        const files = fileNames.reduce((acc, fileName) => {
            acc[fileName] = readFileSync(fileName, 'utf-8');
            return acc;
        }, {} as { [path: string]: string });

        const host = createVirtualCompilerHost({ files, cwd: "/" });
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