import { describe, it, beforeEach } from "node:test";
import { compile } from "../src/index.js";
import * as ts from "typescript";
import { readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "node:assert";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("compile", () => {
    describe("with default output directory", () => {
        let options: ts.CompilerOptions;
        let jsOutputPath: string;

        beforeEach(async () => {
            const configPath = resolve(__dirname, "../../component-my-circle/tsconfig.json");
            const configFile = readFileSync(configPath, 'utf8');
            const { config } = ts.parseConfigFileTextToJson(configPath, configFile);
            
            // Convert config to compiler options
            const result = ts.convertCompilerOptionsFromJson(
                config.compilerOptions,
                "./packages/component-my-circle/src/"
            );
            options = result.options;

            // Compile before each test
            await compile(["./packages/component-my-circle/src/my-circle.ts"], options);
            jsOutputPath = resolve(__dirname, "../../component-my-circle/dist/my-circle.js");
        });

        it("should create JavaScript output file", async () => {
            console.log(jsOutputPath)
            assert.strictEqual(
                existsSync(jsOutputPath),
                true,
                "JavaScript output file should exist after compilation"
            );
        });
    });

    describe("with temporary output directory", () => {
        let options: ts.CompilerOptions;
        let tmpDir: string;
        let jsOutputPath: string;
        let dtsOutputPath: string;
        let jsContent: string;

        beforeEach(async () => {
            tmpDir = "/tmp/foo";
            // Clean up and create tmp directory
            if (existsSync(tmpDir)) {
                rmSync(tmpDir, { recursive: true });
            }
            mkdirSync(tmpDir, { recursive: true });

            // Set up compiler options
            options = {
                outDir: tmpDir,
                rootDir: resolve(__dirname, "../../component-my-circle/src"),
                target: ts.ScriptTarget.ES2015,
                module: ts.ModuleKind.ESNext,
                declaration: true,
                experimentalDecorators: true,
            };

            const inputFile = resolve(__dirname, "../../component-my-circle/src/my-circle.ts");
            await compile([inputFile], options);

            jsOutputPath = resolve(tmpDir, "my-circle.js");
            dtsOutputPath = resolve(tmpDir, "my-circle.d.ts");
            jsContent = readFileSync(jsOutputPath, 'utf8');
        });

        it("should create JavaScript output file", async () => {
            assert.ok(
                existsSync(jsOutputPath),
                "JavaScript output file should exist in temporary directory"
            );
        });

        it("should create TypeScript declaration file", async () => {
            assert.ok(
                existsSync(dtsOutputPath),
                "TypeScript declaration file should exist in temporary directory"
            );
        });

        it("should contain MyCircle class in output", async () => {
            assert.match(
                jsContent,
                /class\s+MyCircle/,
                "Output should contain the MyCircle class definition"
            );
        });
    });

    describe("with transformer enabled", () => {
        const testFile = resolve(__dirname, "./fixtures/transformer-test.ts");
        const outDir = resolve(__dirname, "./fixtures/dist");

        beforeEach(async () => {
            // Clean up output directory if it exists
            if (existsSync(outDir)) {
                rmSync(outDir, { recursive: true });
            }
            mkdirSync(outDir, { recursive: true });
        });

        it("should transform import statements to include .js extension", async () => {
            const options = {
                outDir,
                module: ts.ModuleKind.NodeNext,
                target: ts.ScriptTarget.ESNext,
                moduleResolution: ts.ModuleResolutionKind.NodeNext,
                allowImportingTsExtensions: true,
                skipLibCheck: true,
                useTransformer: true
            };

            const result = await compile([testFile], options);
            
            // Log any compilation errors
            if (result.diagnostics.length > 0) {
                console.log("Compilation errors:");
                result.diagnostics.forEach(diagnostic => {
                    if (diagnostic.file) {
                        const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
                        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                        console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
                    } else {
                        console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
                    }
                });
            }
            // console.log(result.diagnostics)
            // Check if compilation was successful
            //assert.strictEqual(result.diagnostics.length, 0, "Compilation should succeed without errors");
            
            // Read the output file
            const outputPath = resolve(outDir, "transformer-test.js");
            const outputContent = readFileSync(outputPath, 'utf8');
            // console.log(outputContent)
            // Verify that the import statement includes .js extension
            assert.match(
                outputContent,
                /import.*from.*\.js['"];/,
                "Output should contain import statement with .js extension"
            );
        });
    });
});