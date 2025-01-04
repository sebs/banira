import { describe, it, beforeEach } from "node:test";
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
    
    beforeEach(() => {
        const options: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            outDir,
            moduleResolution: ts.ModuleResolutionKind.Node10,
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
        beforeEach(() => { 
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

        it("gets > 10K comments", () => {
            assert.ok(analyzer.comments.length>1000);
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
    });
});
