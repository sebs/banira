import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Compiler } from "../src/compiler.js";
import * as ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Compiler", () => {
    let compiler: Compiler;
    const testFile = resolve(__dirname, "./fixtures/simple.ts");
    
    beforeEach(() => {
        const options: ts.CompilerOptions = {
            outDir: resolve(__dirname, "./dist"),
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: false
        };
        compiler = new Compiler([testFile], options);
    });

    it("should initialize with correct configuration", () => {
        assert.deepStrictEqual(compiler.fileNames, [testFile]);
        assert.deepStrictEqual(compiler.options.target, ts.ScriptTarget.ES2015);
        assert.deepStrictEqual(compiler.options.module, ts.ModuleKind.ES2015);
    });

    it("should emit without errors for valid TypeScript", () => {
        const result = compiler.emit();
        
        assert.ok(result.program, "Program should be created");
        assert.ok(result.emitResult, "Emit result should be present");
        assert.strictEqual(result.diagnostics.length, 0, "Should have no diagnostics");
        assert.strictEqual(result.preEmitDiagnostics.length, 0, "Should have no pre-emit diagnostics");
    });

    it("should include transformer in default transformers", () => {
        assert.ok(compiler.defaultTransformers.after, "Should have after transformers");
        assert.strictEqual(compiler.defaultTransformers.after?.length, 1, "Should have one transformer");
    });
});
