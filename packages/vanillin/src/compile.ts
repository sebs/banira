import * as ts from "typescript";

export interface CompilationResult {
    emitResult: ts.EmitResult;
    program: ts.Program;
    diagnostics: ts.Diagnostic[];
}


export function compile(fileNames: string[], options: ts.CompilerOptions = {}): CompilationResult {
    // Merge provided options with defaults, ensuring outDir is set
    const mergedOptions =  options;
    
    const program = ts.createProgram(fileNames, mergedOptions);
    const emitResult = program.emit();
    
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    return {
        emitResult,
        program,
        diagnostics: allDiagnostics
    };
}
