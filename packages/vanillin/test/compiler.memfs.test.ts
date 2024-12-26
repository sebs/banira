import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { resolve } from "path";
import { Compiler } from "../src/compiler.js";
import * as ts from "typescript";
import { createVirtualCompilerHost } from "../src/virtual-fs";

describe("Compiler with Virtual FileSystem", () => {
    let compiler: Compiler;
    const testFile = "/src/test.ts";
    const testContent = `
        export function hello() {
            return "Hello, World!";
        }
    `;

    beforeEach(() => {
        const options: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            outDir: "/dist",
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: false
        };

        const host = createVirtualCompilerHost({
            files: {
                [testFile]: testContent
            },
            cwd: "/"
        });

        compiler = new Compiler([testFile], options, host);
    });

    it("should emit to virtual file system", () => {
        const customOutDir = "/dist/custom";
        const result = compiler.emit(customOutDir);
        
        assert.ok(result.program, "Program should be created");
        assert.strictEqual(result.program.getCompilerOptions().outDir, customOutDir, 
            "Should use custom outDir in compiler options");
        assert.strictEqual(result.diagnostics.length, 0, 
            "Should have no compilation errors");
    });
});
