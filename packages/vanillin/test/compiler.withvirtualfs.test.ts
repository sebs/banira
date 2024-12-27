import { describe, it, before } from "node:test";
import assert from "node:assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Compiler, CompilerResult } from "../src/compiler.js";
import * as ts from "typescript";
import { ResultAnalyzer } from "../src/result-analyzer.js";
import { VirtualCompilerHost } from "../src/virtual-fs.js";
import { DiagResult } from "../dist/result-analyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = resolve(__dirname, "fixtures/simple.ts");

describe("Compiler.withVirtualFs", () => {
    let compiler: Compiler;
    let result: CompilerResult;
    let analyzer: ResultAnalyzer;
    const customOutDir = "/dist";
    const expectedOutputFile = `${customOutDir}/simple.js`;

    before(async () => {
        const options: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            outDir: customOutDir,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: false,
            noEmitOnError: false,
            lib: [
                "lib.es2015.d.ts",
                "lib.dom.d.ts",
                "lib.es5.d.ts"
            ]
        };

        compiler = await Compiler.withVirtualFs([fixturePath], options);
        result = compiler.emit();
        analyzer = new ResultAnalyzer(result);
    });

    describe("program creation", () => {
        it("creates a program", () => {
            assert.ok(result.program);
        });

        it("uses specified output directory", () => {
            assert.strictEqual(
                result.program?.getCompilerOptions().outDir, 
                customOutDir
            );
        });
    });

    describe("analyzer", () => {
        describe("diagnostics", () => {
            let diagnostics: DiagResult;
            
            before(() => {
                diagnostics = analyzer.diag();
            });

            it("hasErrors false", () => {
                assert.equal(diagnostics.hasErrors, false);
            });

            it("errors empty", () => {
                assert.equal(diagnostics.errors.length, 0);
            });

            it("formatted empty", () => {
                assert.equal(diagnostics.formatted, "");
            });
        });
    });

    describe("SimpleTest class", () => {
        let simpleFile: ts.SourceFile | undefined;

        before(() => {
            const sourceFiles = result.program?.getSourceFiles() || [];
            simpleFile = sourceFiles.find(file => file.fileName === fixturePath);
        });

        it("finds source file", () => {
            assert.ok(simpleFile);
        });

        it("has one class declaration", () => {
            const classDeclarations = simpleFile?.statements.filter(
                statement => ts.isClassDeclaration(statement)
            );
            assert.strictEqual(classDeclarations?.length, 1);
        });

        it("has correct class name", () => {
            const classDeclarations = simpleFile?.statements.filter(
                statement => ts.isClassDeclaration(statement)
            );
            const className = (classDeclarations?.[0] as ts.ClassDeclaration).name?.text;
            assert.strictEqual(className, "SimpleTest");
        });
    });

    describe("generated JavaScript", () => {
        let jsContent: string;

        before(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const host = (compiler as any).host as VirtualCompilerHost;
            jsContent = host.volume.readFileSync(expectedOutputFile, 'utf8').toString();
        });

        it("generates JavaScript file", () => {
            assert.ok(jsContent);
        });

        it("contains SimpleTest class", () => {
            assert.ok(jsContent.includes("class SimpleTest"));
        });

        it("contains sayHello method", () => {
            assert.ok(jsContent.includes("sayHello()"));
        });

        it("contains correct return statement", () => {
            assert.ok(jsContent.includes('return "Hello from SimpleTest"'));
        });
    });
});
