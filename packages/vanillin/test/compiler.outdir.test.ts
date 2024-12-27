import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Compiler } from "../src/compiler.js";
import * as ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Compiler outDir", () => {
    let compiler: Compiler;
    let result: { program: ts.Program | undefined; diagnostics: readonly ts.Diagnostic[] };
    const testFile = resolve(__dirname, "./fixtures/simple.ts");
    const originalOutDir = resolve(__dirname, "./fixtures/dist");
    const customOutDir = resolve(__dirname, "./dist/custom");
    
    beforeEach(() => {
        const options = Compiler.DEFAULT_COMPILER_OPTIONS;
        options.outDir = originalOutDir;
        compiler = new Compiler([testFile], options);
    });

    describe("when custom outDir is provided", () => {
        beforeEach(() => {
            result = compiler.emit(customOutDir);
        });

        it("should create a program", () => {
            assert.ok(result.program, "Program should be created");
        });

        it("should use the custom outDir in program options", () => {
            assert.strictEqual(
                result.program?.getCompilerOptions().outDir,
                customOutDir,
                "Should use custom outDir in compiler options"
            );
        });

        it("should preserve original compiler options", () => {
            assert.strictEqual(
                compiler.options.outDir,
                originalOutDir,
                "Should not modify original compiler options"
            );
        });
    });

    describe("when no custom outDir is provided", () => {
        beforeEach(() => {
            result = compiler.emit();
        });

        it("should create a program", () => {
            assert.ok(result.program, "Program should be created");
        });

        it("should use the original outDir in program options", () => {
            assert.strictEqual(
                result.program?.getCompilerOptions().outDir,
                originalOutDir,
                "Should preserve original outDir in compiler options"
            );
        });

        it("should preserve original compiler options", () => {
            assert.strictEqual(
                compiler.options.outDir,
                originalOutDir,
                "Should not modify original compiler options"
            );
        });
    });
});
