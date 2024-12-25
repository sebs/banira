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
        try {
            // Example usage:
            runCliProgram(cliPath, ['--help'])
                .then((result: any) => {
                    console.log('STDOUT:', result.stdout);
                    console.log('STDERR:', result.stderr);
                    console.log('Exit Code:', result.exitCode);
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        } catch (error) {
            assert.fail(`Failed to show help message: ${error}`);
        }
    });

});

interface ChildProcessWithStreams extends ChildProcess {
    stdout: Readable;
    stderr: Readable;
}

function runCliProgram(command: string, args: string[] = []) {
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