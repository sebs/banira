import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Compiler } from "../src/compiler.js";
import * as ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = resolve(__dirname, "fixtures/simple.ts");

describe("Compiler.withVirtualFs", () => {
    let compiler: Compiler;
    let result: { program: ts.Program | undefined; diagnostics: readonly ts.Diagnostic[] };
    const customOutDir = "/dist";
    const expectedOutputFile = `${customOutDir}/simple.js`;

    beforeEach(() => {
        const options: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            outDir: customOutDir,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: false
        };

        compiler = Compiler.withVirtualFs([fixturePath], options);
        result = compiler.emit();
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
        assert.strictEqual(result.diagnostics.length, 0, 
            "Should compile without errors"
        );
    });

    it("should compile SimpleTest class correctly", () => {
        const sourceFiles = result.program?.getSourceFiles() || [];
        const simpleFile = sourceFiles.find(file => file.fileName === fixturePath);
        assert.ok(simpleFile, "Should find the simple.ts source file");

        const classDeclarations = simpleFile?.statements.filter(
            statement => ts.isClassDeclaration(statement)
        );
        assert.strictEqual(classDeclarations?.length, 1, "Should have one class declaration");
        
        const className = (classDeclarations?.[0] as ts.ClassDeclaration).name?.text;
        assert.strictEqual(className, "SimpleTest", "Class should be named SimpleTest");
    });
});
