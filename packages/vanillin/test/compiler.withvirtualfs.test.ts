import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Compiler, CompilerResult } from "../src/compiler.js";
import * as ts from "typescript";
import { ResultAnalyzer } from "../src/result-analyzer.js";
import { VirtualCompilerHost } from "../src/virtual-fs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = resolve(__dirname, "fixtures/simple.ts");

describe("Compiler.withVirtualFs", () => {
    let compiler: Compiler;
    let result: CompilerResult;
    let analyzer: ResultAnalyzer;
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
        analyzer = new ResultAnalyzer(result);
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

    it("should generate correct JavaScript output", () => {
        // Get the file contents from the virtual filesystem
        const host = (compiler as any).host as VirtualCompilerHost;
        const jsContent = host.volume.readFileSync(expectedOutputFile, 'utf8');
        assert.ok(jsContent, "Should be able to read the generated JavaScript file");

        // Verify the content
        assert.ok(jsContent.includes("class SimpleTest"), "Should contain SimpleTest class");
        assert.ok(jsContent.includes("sayHello()"), "Should contain sayHello method");
        assert.ok(jsContent.includes("return \"Hello from SimpleTest\""), "Should contain the return statement");
    });
});
