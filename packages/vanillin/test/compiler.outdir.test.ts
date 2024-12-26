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
    const testFile = resolve(__dirname, "./fixtures/simple.ts");
    
    beforeEach(() => {
        const options: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            outDir: resolve(__dirname, "./fixtures/dist"),
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: false
        };
        compiler = new Compiler([testFile], options);
    });

    it("should use provided outDir when emitting", () => {
        const customOutDir = resolve(__dirname, "./dist/custom1");
        const result = compiler.emit(customOutDir);
        
        assert.ok(result.program, "Program should be created");
        assert.strictEqual(result.program.getCompilerOptions().outDir, customOutDir, 
            "Should use custom outDir in compiler options");
    });

    it("should preserve original outDir when no custom outDir provided", () => {
        const originalOutDir = compiler.options.outDir;
        const result = compiler.emit();
        
        assert.ok(result.program, "Program should be created");
        assert.strictEqual(result.program.getCompilerOptions().outDir, originalOutDir, 
            "Should preserve original outDir in compiler options");
    });

    it("should override original outDir when custom outDir provided", () => {
        const originalOutDir = compiler.options.outDir;
        const customOutDir = resolve(__dirname, "./dist/custom2");
        const result = compiler.emit(customOutDir);
        
        assert.ok(result.program, "Program should be created");
        assert.strictEqual(result.program.getCompilerOptions().outDir, customOutDir, 
            "Should override original outDir with custom outDir");
        
        // Verify original options weren't modified
        assert.strictEqual(compiler.options.outDir, originalOutDir, 
            "Should not modify original compiler options");
    });
});
