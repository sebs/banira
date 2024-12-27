import { Program, EmitResult, Diagnostic, SourceFile, CompilerOptions, DiagnosticCategory, formatDiagnosticsWithColorAndContext, sys, getPreEmitDiagnostics } from 'typescript';
import  { CompilerResult } from './compiler';

/**
 * Interface representing the result of diagnostic analysis
 * 
 * @interface DiagResult
 * @property {boolean} hasErrors - Indicates if there are any compilation errors
 * @property {boolean} hasWarnings - Indicates if there are any compilation warnings
 * @property {Diagnostic[]} errors - Array of compilation error diagnostics
 * @property {Diagnostic[]} warnings - Array of compilation warning diagnostics
 * @property {string} formatted - Formatted string representation of all diagnostics
 */
export interface DiagResult {
    hasErrors: boolean;
    hasWarnings: boolean;
    errors: Diagnostic[];
    warnings: Diagnostic[];
    formatted: string;
}

/**
 * Analyzes compilation results and provides diagnostic information
 * 
 * @remarks
 * This class processes TypeScript compilation results and provides methods to
 * analyze diagnostics, access compiler options, and retrieve source and output files.
 * 
 * @example
 * ```typescript
 * const compiler = new Compiler(['src/file.ts'], options);
 * const result = compiler.emit();
 * const analyzer = new ResultAnalyzer(result);
 * const diagnostics = analyzer.diag();
 * 
 * if (diagnostics.hasErrors) {
 *   console.error(diagnostics.formatted);
 * }
 * ```
 */
export class ResultAnalyzer {
    private program: Program;
    private emitResult: EmitResult;

    /**
     * Creates a new ResultAnalyzer instance
     * 
     * @param result - The compilation result to analyze
     */
    constructor(result: CompilerResult) {
        const { program, emitResult } = result;
        this.program = program;
        this.emitResult = emitResult;
    }

    /**
     * Gets the compiler options used in the compilation
     * 
     * @returns The TypeScript compiler options
     */
    get compilerOptions(): CompilerOptions {
        return this.program.getCompilerOptions();
    }

    /**
     * Gets all source files included in the compilation
     * 
     * @returns Array of TypeScript source files
     */
    get sourceFiles(): readonly SourceFile[] {
        return this.program.getSourceFiles();
    }

    /**
     * Gets the paths of all emitted (output) files
     * 
     * @returns Array of output file paths
     */
    get outputFiles(): string[] {
        if (!this.emitResult.emittedFiles) {
            return [];
        }
        return this.emitResult.emittedFiles;
    }

    /**
     * Analyzes compilation diagnostics and returns detailed results
     * 
     * @remarks
     * This method processes both emit diagnostics and pre-emit diagnostics,
     * categorizing them into errors and warnings. It also provides a formatted
     * string representation of all diagnostics with color and context.
     * 
     * @returns A {@link DiagResult} object containing diagnostic information
     */
    diag(): DiagResult {
        const diagnostics = [
            ...this.emitResult.diagnostics, 
            ...getPreEmitDiagnostics(this.program)
        ];
        const hasErrors = diagnostics.some(d => d.category === DiagnosticCategory.Error);
        const hasWarnings = diagnostics.some(d => d.category === DiagnosticCategory.Warning);
        const errors = diagnostics.filter(d => d.category === DiagnosticCategory.Error);
        const warnings = diagnostics.filter(d => d.category === DiagnosticCategory.Warning);
        const formatted = formatDiagnosticsWithColorAndContext(diagnostics, {
            getCurrentDirectory: () => process.cwd(),
            getCanonicalFileName: fileName => fileName,
            getNewLine: () => sys.newLine
        });

        return {
            hasErrors,
            hasWarnings,
            errors,
            warnings,
            formatted
        }
    }
}
