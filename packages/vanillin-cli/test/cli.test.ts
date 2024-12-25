import { describe, it } from "node:test";
import { spawn, type ChildProcess } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "node:assert";
import { type Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliPath = resolve(__dirname, "../dist/packages/vanillin-cli/src/index.js");

describe("vanillin CLI", () => {
    it("should show help message", async () => {
        const result = await runCliProgram("node", [cliPath, "--help"]);
        assert.match(result.stdout + result.stderr, /CLI tool for Vanillin\.js/);
        assert.strictEqual(result.exitCode, 0);
    });

    it("should compile TypeScript file", async () => {
        const result = await runCliProgram("node", [
            cliPath,
            "compile",
            "--project", resolve(__dirname, "fixtures/tsconfig.json"),
            "./test/fixtures/test.ts"
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected successful compilation");
        assert.match(result.stdout, /Compilation complete/);
    });
});

interface ChildProcessWithStreams extends ChildProcess {
    stdout: Readable;
    stderr: Readable;
}

interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
}

function runCliProgram(command: string, args: string[] = []): Promise<CliResult> {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args);
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code
            });
        });

        process.on('error', (error) => {
            reject(error);
        });
    });
}