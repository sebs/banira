import { describe, it } from "node:test";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "node:assert";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliPath = resolve(__dirname, "../dist/packages/banira-cli/src/index.js");

describe("banira CLI", () => {
    it("should show help message", async () => {
        const result = await runCommand(['--help']);
        assert.match(result.stdout, /Usage: banira/);
    });

    it("should compile TypeScript file", async () => {
        const result = await runCommand([
            'compile',
            '-p',
            '../component-my-circle/tsconfig.json',
            '../component-my-circle/src/my-circle.ts'
        ]);
        // assert.strictEqual(result.exitCode, 0, "Expected successful compilation");
        assert.match(result.stdout, /Compilation complete/);
    });

    it("should generate documentation for TypeScript file", async () => {
        const result = await runCommand([
            'doc',
            '../component-my-circle/src/my-circle.ts'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected successful documentation generation");
        assert.ok(result.stdout.length > 0, "Expected documentation output");
        assert.ok(!result.stderr, "Expected no errors");
        console.log(result.stdout);
    });
});

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