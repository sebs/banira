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
    let result: { program: ts.Program | undefined; diagnostics: readonly ts.Diagnostic[]; preEmitDiagnostics: readonly ts.Diagnostic[]; emitResult: ts.EmitResult | undefined };
    const testFile = resolve(__dirname, "./fixtures/simple.ts");
    const outDir = resolve(__dirname, "./dist");
    
    beforeEach(() => {
        const options: ts.CompilerOptions = {
            outDir,
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: false
        };
        compiler = new Compiler([testFile], options);
    });

    describe("initialization", () => {
        it("should set correct file names", () => {
            assert.deepStrictEqual(
                compiler.fileNames,
                [testFile],
                "Should initialize with the correct file names"
            );
        });

        it("should set correct target", () => {
            assert.deepStrictEqual(
                compiler.options.target,
                ts.ScriptTarget.ES2015,
                "Should initialize with ES2015 target"
            );
        });

        it("should set correct module kind", () => {
            assert.deepStrictEqual(
                compiler.options.module,
                ts.ModuleKind.ES2015,
                "Should initialize with ES2015 module kind"
            );
        });
    });

    describe("DEFAULT_COMPILER_OPTIONS", () => {
        it("should have correct target", () => {
            assert.strictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.target,
                ts.ScriptTarget.ES2015,
                "Should have ES2015 target"
            );
        });

        it("should have correct module kind", () => {
            assert.strictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.module,
                ts.ModuleKind.ES2015,
                "Should have ES2015 module kind"
            );
        });

        it("should have correct module resolution", () => {
            assert.strictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.moduleResolution,
                ts.ModuleResolutionKind.NodeJs,
                "Should have NodeJs module resolution"
            );
        });

        it("should have correct lib files", () => {
            assert.deepStrictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.lib,
                ["lib.es2015.d.ts", "lib.dom.d.ts", "lib.es5.d.ts"],
                "Should have correct lib files"
            );
        });

        it("should have correct outDir", () => {
            assert.strictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.outDir,
                './dist',
                "Should have ./dist as outDir"
            );
        });

        it("should have correct esModuleInterop setting", () => {
            assert.strictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.esModuleInterop,
                true,
                "Should have esModuleInterop enabled"
            );
        });

        it("should have correct skipLibCheck setting", () => {
            assert.strictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.skipLibCheck,
                true,
                "Should have skipLibCheck enabled"
            );
        });

        it("should have correct strict setting", () => {
            assert.strictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.strict,
                false,
                "Should have strict disabled"
            );
        });

        it("should have correct noEmitOnError setting", () => {
            assert.strictEqual(
                Compiler.DEFAULT_COMPILER_OPTIONS.noEmitOnError,
                false,
                "Should have noEmitOnError disabled"
            );
        });
    });

    describe("emission", () => {
        beforeEach(() => {
            result = compiler.emit();
        });

        it("should create a program", () => {
            assert.ok(
                result.program,
                "Program should be created"
            );
        });

        it("should create emit result", () => {
            assert.ok(
                result.emitResult,
                "Emit result should be present"
            );
        });

        it("should have no diagnostics", () => {
            assert.strictEqual(
                result.diagnostics.length,
                0,
                "Should have no diagnostics"
            );
        });

        it("should have no pre-emit diagnostics", () => {
            assert.strictEqual(
                result.preEmitDiagnostics.length,
                0,
                "Should have no pre-emit diagnostics"
            );
        });
    });

    describe("transformers", () => {
        it("should have after transformers", () => {
            assert.ok(
                compiler.defaultTransformers.after,
                "Should have after transformers"
            );
        });

        it("should have exactly one transformer", () => {
            assert.strictEqual(
                compiler.defaultTransformers.after?.length,
                1,
                "Should have one transformer"
            );
        });
    });
});
