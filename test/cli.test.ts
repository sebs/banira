import { describe, it } from "node:test";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFile, rm } from "fs/promises";
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

    it("manifest --md emits Markdown API docs", async () => {
        const result = await runCommand([
            'manifest',
            'examples/my-circle/my-circle.ts',
            '--md'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected successful markdown generation");
        assert.match(result.stdout, /## `<my-circle>`/);
        assert.match(result.stdout, /### Attributes/);
    });

    it("manifest --validate reports a valid manifest", async () => {
        const result = await runCommand([
            'manifest',
            'examples/my-circle/my-circle.ts',
            '--validate'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected validation to pass");
        assert.match(result.stdout, /Manifest is valid/);
    });

    it("types emits a tag-name map augmentation", async () => {
        const result = await runCommand([
            'types',
            'examples/my-circle/my-circle.ts'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected successful type generation");
        assert.match(result.stdout, /interface HTMLElementTagNameMap/);
        assert.match(result.stdout, /'my-circle':/);
    });

    it("test runs a manifest-driven smoke test", async () => {
        const result = await runCommand([
            'test',
            'examples/my-circle/my-circle.ts'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected smoke test to pass");
        assert.match(result.stdout, /PASS <my-circle>/);
        assert.match(result.stdout, /1\/1 passed/);
    });

    it("prerender emits a declarative shadow DOM template", async () => {
        const result = await runCommand([
            'prerender',
            'examples/my-circle/my-circle.ts'
        ]);
        assert.strictEqual(result.exitCode, 0, "Expected successful prerender");
        assert.match(result.stdout, /<my-circle>/);
        assert.match(result.stdout, /<template shadowrootmode="open">/);
    });

    it("init scaffolds a component into a directory", async () => {
        const dir = `dist/.cli-init-test-${Date.now()}`;
        const result = await runCommand(['init', 'demo-button', dir]);
        assert.strictEqual(result.exitCode, 0, "Expected successful scaffold");
        assert.match(result.stdout, /Created/);
        const source = await readFile(resolve(dir, 'demo-button.ts'), 'utf8');
        assert.match(source, /class DemoButton extends HTMLElement/);
        await rm(dir, { recursive: true, force: true });
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