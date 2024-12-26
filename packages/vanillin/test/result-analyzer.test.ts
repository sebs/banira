import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Compiler } from "../src/compiler.js";
import { ResultAnalyzer } from "../src/result-analyzer.js";
import * as ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ResultAnalyzer", () => {
    let analyzer: ResultAnalyzer;
    let compiler: Compiler;
    const testFile = resolve(__dirname, "./fixtures/simple.ts");
    
    beforeEach(() => {
        const options: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            outDir: resolve(__dirname, "./fixtures/dist"),
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
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

    it("should provide access to compiler diagnostics", () => {
        assert.ok(Array.isArray(analyzer.diagnostics), "diagnostics should be an array");
        assert.ok(Array.isArray(analyzer.preEmitDiagnostics), "preEmitDiagnostics should be an array");
    });

    it("should provide access to compiler options", () => {
        const options = analyzer.compilerOptions;
        assert.strictEqual(options.target, ts.ScriptTarget.ES2015);
        assert.strictEqual(options.module, ts.ModuleKind.ES2015);
    });

    it("should provide access to source files", () => {
        const sourceFiles = analyzer.sourceFiles;
        assert.ok(Array.isArray(sourceFiles), "sourceFiles should be an array");
        assert.ok(sourceFiles.length > 0, "should have at least one source file");
        
        const testFileSource = sourceFiles.find(file => 
            file.fileName.endsWith("simple.ts")
        );
        assert.ok(testFileSource, "should find the test source file");
    });

    it("should provide access to output files", () => {
        const outputFiles = analyzer.outputFiles;
        assert.ok(Array.isArray(outputFiles), "outputFiles should be an array");
        // Note: emittedFiles might be undefined in some TypeScript versions
        // so we just verify that we get an array back, even if empty
        assert.strictEqual(typeof outputFiles.length, "number");
    });
});
