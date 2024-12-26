import { createProgram, CompilerOptions, Program, CustomTransformers, getPreEmitDiagnostics, Diagnostic, EmitResult }  from "typescript";
import transformer from './transformer.js';

export interface CompilerResult {
    program: Program;
    emitResult: EmitResult;
    diagnostics: readonly Diagnostic[];
    preEmitDiagnostics: readonly Diagnostic[];
}

export class Compiler {

    public readonly fileNames: string[];
    public readonly  options: CompilerOptions;
    public readonly defaultTransformers: CustomTransformers;

    constructor(fileNames: string[], options: CompilerOptions) {
        this.fileNames = fileNames;
        this.options = options;
        // append .js to all imports
        this.defaultTransformers = {
            after: [transformer()]
        }
    }

    emit(): CompilerResult {
        const program: Program = createProgram(this.fileNames, this.options);
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