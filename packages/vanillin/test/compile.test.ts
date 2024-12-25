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

        beforeEach(() => {
            const configPath = resolve(__dirname, "../../component-my-circle/tsconfig.json");
            const configFile = readFileSync(configPath, 'utf8');
            const { config } = ts.parseConfigFileTextToJson(configPath, configFile);
            
            // Convert config to compiler options
            const result = ts.convertCompilerOptionsFromJson(
                config.compilerOptions,
                "./packages/component-my-circle/src/"
            );
            options = result.options;

            jsOutputPath = resolve(__dirname, "../../component-my-circle/dist/my-circle/my-circle.js");
            
            // Compile before each test
            compile(["./packages/component-my-circle/src/my-circle.ts"], options);
        });

        it("should create JavaScript output file", () => {
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

        beforeEach(() => {
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
            compile([inputFile], options);

            jsOutputPath = resolve(tmpDir, "my-circle.js");
            dtsOutputPath = resolve(tmpDir, "my-circle.d.ts");
            jsContent = readFileSync(jsOutputPath, 'utf8');
        });

        it("should create JavaScript output file", () => {
            assert.ok(
                existsSync(jsOutputPath),
                "JavaScript output file should exist in temporary directory"
            );
        });

        it("should create TypeScript declaration file", () => {
            assert.ok(
                existsSync(dtsOutputPath),
                "TypeScript declaration file should exist in temporary directory"
            );
        });

        it("should contain MyCircle class in output", () => {
            assert.match(
                jsContent,
                /class\s+MyCircle/,
                "Output should contain the MyCircle class definition"
            );
        });
    });
});