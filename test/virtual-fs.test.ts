import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { Compiler } from "../src/compiler.js";
import * as ts from "typescript";
import { createVirtualCompilerHost, VirtualCompilerHost } from "../src/virtual-fs.js";

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
            moduleResolution: ts.ModuleResolutionKind.Bundler,
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

    it("emits a .js.map with the original source and links it (issue #47)", () => {
        // The default compiler options turn source maps on; use them here.
        const mapHost = createVirtualCompilerHost({ files: { [testFile]: testContent }, cwd: "/" });
        const mapCompiler = new Compiler([testFile], Compiler.DEFAULT_COMPILER_OPTIONS, mapHost);
        mapCompiler.emit("/dist/maps");

        const js = mapHost.volume.readFileSync("/dist/maps/test.js", "utf8") as string;
        assert.match(js, /\/\/# sourceMappingURL=test\.js\.map/);

        const map = JSON.parse(mapHost.volume.readFileSync("/dist/maps/test.js.map", "utf8") as string);
        assert.ok(
            map.sources?.some((s: string) => s.endsWith("test.ts")),
            "map should reference the original .ts source"
        );
        assert.ok(
            map.sourcesContent?.[0]?.includes("Hello, World!"),
            "inlineSources should embed the original TypeScript in the map"
        );
    });
});
