import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { resolve } from "path";
import { Compiler } from "../src/compiler.js";
import * as ts from "typescript";
import { createVirtualCompilerHost, VirtualCompilerHost } from "../src/virtual-fs";

describe("Virtual FileSystem", () => {
    let compiler: Compiler;
    let host: VirtualCompilerHost;
    let result: { program: ts.Program | undefined; diagnostics: readonly ts.Diagnostic[] };
    const testFile = "/src/test.ts";
    const customOutDir = "/dist/custom";
    const expectedOutputFile = `${customOutDir}/test.js`;
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

        host = createVirtualCompilerHost({
            files: {
                [testFile]: testContent
            },
            cwd: "/"
        });

        compiler = new Compiler([testFile], options, host);
        result = compiler.emit(customOutDir);
    });

    it("should create a program", () => {
        assert.ok(result.program, "Program should be created");
    });

    it("should use the specified output directory", () => {
        assert.strictEqual(
            result.program?.getCompilerOptions().outDir, 
            customOutDir,
            "Should use custom outDir in compiler options"
        );
    });

    it("should compile without errors", () => {
        assert.strictEqual(
            result.diagnostics.length, 
            0,
            "Should have no compilation errors"
        );
    });

    it("should create the output file in virtual filesystem", () => {
        assert.ok(
            host.volume.existsSync(expectedOutputFile),
            `Output file should exist at ${expectedOutputFile}`
        );
    });

    it("should generate correct JavaScript output", () => {
        const fileContent = host.volume.readFileSync(expectedOutputFile, 'utf8');
        assert.ok(
            fileContent.includes('function hello'),
            'Output file should contain the compiled function'
        );
    });
});
