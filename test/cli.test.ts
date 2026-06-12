import { describe, it } from "node:test";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "node:assert";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliPath = resolve(__dirname, "../dist/cli/index.js");

// Each test spawns its own CLI process, so they can run concurrently.
describe("banira CLI", { concurrency: true }, () => {
    it("should show help message", async () => {
        const result = await runCommand(['--help']);
        assert.match(result.stdout, /Usage: banira/);
    });

    it("should compile TypeScript file", async () => {
        const result = await runCommand([
            'compile',
            'examples/my-circle/my-circle.ts',
            '-o',
            'dist/.cli-test-out'
        ]);
        // assert.strictEqual(result.exitCode, 0, "Expected successful compilation");
        assert.match(result.stdout, /Compilation complete/);
    });

    it("should generate documentation for TypeScript file", async () => {
        const result = await runCommand([
            'doc',
            'examples/my-circle/my-circle.ts'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected successful documentation generation");
        assert.ok(result.stdout.length > 0, "Expected documentation output");
        assert.ok(!result.stderr, "Expected no errors");
    });

    it("doc --script-src and --stylesheet none produce an offline-safe page", async () => {
        const result = await runCommand([
            'doc',
            'examples/my-circle/my-circle.ts',
            '--script-src', './my-circle.js',
            '--stylesheet', 'none'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected successful documentation generation");
        assert.match(result.stdout, /<script type="module" src="\.\/my-circle\.js">/);
        assert.doesNotMatch(result.stdout, /picocss/, "Expected no CDN stylesheet");
        assert.doesNotMatch(result.stdout, /<link rel="stylesheet"/);
    });

    it("should generate a custom elements manifest", async () => {
        const result = await runCommand([
            'manifest',
            'examples/my-circle/my-circle.ts'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected successful manifest generation");
        const manifest = JSON.parse(result.stdout);
        assert.strictEqual(manifest.schemaVersion, '2.1.0');
        const decl = manifest.modules.flatMap((m: { declarations: unknown[] }) => m.declarations)[0];
        assert.strictEqual(decl.tagName, 'my-circle');
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