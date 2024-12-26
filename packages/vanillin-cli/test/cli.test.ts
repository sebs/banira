import { describe, it } from "node:test";
import { spawn, type ChildProcess } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "node:assert";
import { type Readable } from "stream";
import { writeFile, readFile, rm } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliPath = resolve(__dirname, "../dist/packages/vanillin-cli/src/index.js");

describe("vanillin CLI", () => {
    it("should show help message", async () => {
        const result = await runCommand(['--help']);
        assert.match(result.stdout, /Usage: vanillin/);
    });

    it("should compile TypeScript file", async () => {
        const result = await runCommand(['compile', '../component-my-circle/src/my-circle.ts']);
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

function runCommand(args: string[] = []): Promise<CliResult> {
    return new Promise((resolve, reject) => {
        const process = spawn('node', [cliPath, ...args]);
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