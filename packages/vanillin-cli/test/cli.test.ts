import { describe, it } from "node:test";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "node:assert";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliPath = resolve(__dirname, "../dist/packages/vanillin-cli/src/index.js");

describe("vanillin CLI", () => {
    it("should show help message", async () => {
        const { stdout } = await runCLI(["--help"]);
        assert.match(stdout, /Usage:/);
    });

    it("should compile TypeScript file", async () => {
        const { stdout, stderr } = await runCLI([
            "compile",
            "--project", resolve(__dirname, "fixtures/tsconfig.json"),
            "./test/fixtures/test.ts"
        ]);
        assert.strictEqual(stderr, "", "Expected no errors");
        assert.match(stdout, /Compilation complete/);
    });
});

function runCLI(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const cli = spawn("node", [cliPath, ...args], {
            cwd: resolve(__dirname, "..")
        });
        let stdout = "";
        let stderr = "";

        cli.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        cli.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        cli.on("close", (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`CLI exited with code ${code}\n${stderr}`));
            }
        });
    });
}
