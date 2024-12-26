import * as ts from "typescript";

export interface CompilationResult {
    emitResult: ts.EmitResult;
    program: ts.Program;
    diagnostics: ts.Diagnostic[];
}

export interface VanillinCompilerOptions extends ts.CompilerOptions {
    useTransformer?: boolean;
}

export async function compile(fileNames: string[], options: VanillinCompilerOptions = {}): CompilationResult {
    // Merge provided options with defaults, ensuring outDir is set
    const mergedOptions =  options;
    
    const program = ts.createProgram(fileNames, mergedOptions);
    
    let emitResult: ts.EmitResult;
    if (options.useTransformer) {
        const { default: transformer } = await import('./transformer.js');
        emitResult = program.emit(undefined, undefined, undefined, undefined, { before: [transformer()] });
    } else {
        emitResult = program.emit();
    }
    
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    return {
        emitResult,
        program,
        diagnostics: allDiagnostics
    };
}
