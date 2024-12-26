import { Program, EmitResult, Diagnostic, SourceFile, CompilerOptions } from 'typescript';
import  { CompilerResult } from './compiler';

export class ResultAnalyzer {
    
    private program: Program;
    private emitResult: EmitResult;
    public readonly diagnostics: readonly Diagnostic[];
    public readonly preEmitDiagnostics: readonly Diagnostic[];

    constructor(result: CompilerResult) {
        const { program, emitResult, diagnostics, preEmitDiagnostics } = result;
        this.program = program;
        this.emitResult = emitResult;
        this.diagnostics = diagnostics;
        this.preEmitDiagnostics = preEmitDiagnostics;
    }

    get compilerOptions(): CompilerOptions {
        return this.program.getCompilerOptions();
    }

    get sourceFiles(): readonly SourceFile[] {
        return this.program.getSourceFiles();
    }

    get outputFiles(): string[] {
        if (!this.emitResult.emittedFiles) {
            return [];
        }
        return this.emitResult.emittedFiles;
    }
}
