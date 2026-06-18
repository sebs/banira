import { describe, it, before } from "node:test";
import assert from "node:assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Compiler } from "../src/compiler.js";
import { ResultAnalyzer, DiagResult } from "../src/result-analyzer.js";
import * as ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ResultAnalyzer", () => {
    let analyzer: ResultAnalyzer;
    let compiler: Compiler;
    const testFile = resolve(__dirname, "./fixtures/simple.ts");
    const outDir = resolve(__dirname, "./fixtures/dist");
    
    // The compile is expensive and every test only reads the result, so it
    // runs once for the whole suite.
    before(() => {
        const options: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            outDir,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: false,
            noEmit: false,
            declaration: true
        };
        compiler = new Compiler([testFile], options);
        const result = compiler.emit();
        analyzer = new ResultAnalyzer(result);
    });

    describe("analyzer.diag", ()=>{
        let diag: DiagResult
        before(() => {
            diag = analyzer.diag();
        });

        it("returns diagnostics", () => {
            assert.ok(diag);
        });

        it("hasErrors false", () => {
            assert.equal(diag.hasErrors, false);
        });

        it("has no errors", () => {
            assert.equal(diag.errors.length, 0);
        });


        it("hasWarnings false", () => {
            assert.equal(diag.hasWarnings, false);
        });

        it("has no warnings", () => {
            assert.equal(diag.warnings.length, 0);
        });

        it("has no formatted result", () => {
            assert.equal(diag.formatted, "");
        });
    });
    describe("compiler options", () => {
        it("should have correct target", () => {
            assert.strictEqual(
                analyzer.compilerOptions.target,
                ts.ScriptTarget.ES2015,
                "should use ES2015 target"
            );
        });

        it("should have correct module kind", () => {
            assert.strictEqual(
                analyzer.compilerOptions.module,
                ts.ModuleKind.ES2015,
                "should use ES2015 module kind"
            );
        });
    });

    describe("source files", () => {
        it("should provide source files as an array", () => {
            assert.ok(
                Array.isArray(analyzer.sourceFiles),
                "sourceFiles should be an array"
            );
        });

        it("should have at least one source file", () => {
            assert.ok(
                analyzer.sourceFiles.length > 0,
                "should have at least one source file"
            );
        });

        it("should include the test source file", () => {
            const testFileSource = analyzer.sourceFiles.find(file => 
                file.fileName.endsWith("simple.ts")
            );
            assert.ok(
                testFileSource,
                "should find the test source file"
            );
        });
    });

    describe("comments", () => {
        it("extracts them", () => {
            assert.ok(analyzer.comments);
        });

        it("gets > 5K comments", () => {
            // The program pulls in TypeScript's lib.*.d.ts files, whose exact
            // comment count drifts with the TS version (~13K on TS 5.7, ~7K on
            // TS 6.0), so assert a threshold rather than a brittle exact count.
            assert.ok(
                analyzer.comments.length > 5000,
                `expected > 5000 comments, got ${analyzer.comments.length}`
            );
        });
    }); 


    describe("output files", () => {
        it("should provide output files as an array", () => {
            assert.ok(
                Array.isArray(analyzer.outputFiles),
                "outputFiles should be an array"
            );
        });

        it("should have length property as number", () => {
            assert.strictEqual(
                typeof analyzer.outputFiles.length,
                "number",
                "outputFiles.length should be a number"
            );
        });

        it("lists emitted files under DEFAULT_COMPILER_OPTIONS (#17)", () => {
            const defaultsAnalyzer = new ResultAnalyzer(
                new Compiler([testFile], {
                    ...Compiler.DEFAULT_COMPILER_OPTIONS,
                    outDir,
                }).emit()
            );
            assert.ok(
                defaultsAnalyzer.outputFiles.length > 0,
                "outputFiles should be non-empty after a successful emit"
            );
            assert.ok(
                defaultsAnalyzer.outputFiles.some((f) => f.endsWith(".js")),
                "outputFiles should include the emitted .js"
            );
        });
    });
});
