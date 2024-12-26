import { createProgram, CompilerOptions, Program, CustomTransformers, getPreEmitDiagnostics, Diagnostic, EmitResult, CompilerHost }  from "typescript";
import transformer from './transformer.js';

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
    private readonly host?: CompilerHost;

    constructor(fileNames: string[], options: CompilerOptions, host?: CompilerHost) {
        this.fileNames = fileNames;
        this.options = options;
        this.host = host;
        // append .js to all imports
        this.defaultTransformers = {
            after: [transformer()]
        }
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