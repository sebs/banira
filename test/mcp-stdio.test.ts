import { describe, it, before, after } from 'node:test';
import { spawn, execSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = resolve(repoRoot, 'dist/cli/index.js');

/** A minimal newline-delimited JSON-RPC client over a child process's stdio. */
function rpcClient(child: ChildProcessWithoutNullStreams) {
    const pending = new Map<number, (msg: any) => void>();
    const stdoutLines: string[] = [];
    const badLines: string[] = [];
    let buffer = '';
    let id = 0;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
        buffer += chunk;
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line) continue;
            stdoutLines.push(line);
            let msg: any;
            try {
                msg = JSON.parse(line);
            } catch {
                badLines.push(line); // anything on stdout that isn't a JSON-RPC frame
                continue;
            }
            if (msg && msg.id !== undefined && pending.has(msg.id)) {
                const settle = pending.get(msg.id)!;
                pending.delete(msg.id);
                settle(msg);
            }
        }
    });

    const request = (method: string, params?: unknown): Promise<any> =>
        new Promise((res, rej) => {
            const myId = ++id;
            const timer = setTimeout(() => {
                if (pending.has(myId)) {
                    pending.delete(myId);
                    rej(new Error(`timed out waiting for ${method}`));
                }
            }, 20000);
            pending.set(myId, (msg) => {
                clearTimeout(timer);
                res(msg);
            });
            child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, ...(params !== undefined ? { params } : {}) }) + '\n');
        });

    const notify = (method: string, params?: unknown): void => {
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, ...(params !== undefined ? { params } : {}) }) + '\n');
    };

    return { request, notify, stdoutLines, badLines };
}

describe('banira mcp — stdio integration (milestone 7)', () => {
    let child: ChildProcessWithoutNullStreams;
    let stderr = '';
    let rpc: ReturnType<typeof rpcClient>;

    before(() => {
        if (!existsSync(cliPath)) execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
        child = spawn('node', [cliPath, 'mcp'], { cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'] });
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (d: string) => {
            stderr += d;
        });
        rpc = rpcClient(child);
    });

    after(() => {
        if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    });

    it('completes the initialize handshake over stdio', async () => {
        const res = await rpc.request('initialize', {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'itest', version: '0' },
        });
        assert.strictEqual(res.result.protocolVersion, '2025-11-25');
        assert.strictEqual(res.result.serverInfo.name, 'banira');
        assert.deepStrictEqual(Object.keys(res.result.capabilities).sort(), ['prompts', 'resources', 'tools']);
        rpc.notify('notifications/initialized');
    });

    it('lists tools, resources, and prompts', async () => {
        const tools = await rpc.request('tools/list');
        assert.ok(tools.result.tools.length >= 5);
        const resources = await rpc.request('resources/list');
        assert.ok(resources.result.resources.length >= 1);
        const prompts = await rpc.request('prompts/list');
        assert.ok(prompts.result.prompts.length >= 1);
    });

    it('calls get_component_manifest end-to-end with structuredContent + text mirror', async () => {
        const res = await rpc.request('tools/call', {
            name: 'get_component_manifest',
            arguments: { files: ['examples/my-circle/my-circle.ts'] },
        });
        const decl = res.result.structuredContent.modules[0].declarations[0];
        assert.strictEqual(decl.tagName, 'my-circle');
        assert.strictEqual(res.result.content[0].type, 'text');
        assert.deepStrictEqual(JSON.parse(res.result.content[0].text), res.result.structuredContent);
    });

    it('answers ping and returns -32601 for an unknown method', async () => {
        const pong = await rpc.request('ping');
        assert.deepStrictEqual(pong.result, {});
        const unknown = await rpc.request('does/not/exist');
        assert.strictEqual(unknown.error.code, -32601);
    });

    it('keeps stdout clean (only JSON-RPC frames) and logs the banner to stderr', () => {
        assert.deepStrictEqual(rpc.badLines, [], `non-JSON-RPC output on stdout: ${JSON.stringify(rpc.badLines)}`);
        assert.ok(rpc.stdoutLines.length > 0);
        assert.match(stderr, /banira MCP server ready/);
    });

    it('shuts down cleanly on SIGTERM (exit code 0)', async () => {
        const exitCode = await new Promise<number | null>((res) => {
            child.once('exit', (code) => res(code));
            child.kill('SIGTERM');
        });
        assert.strictEqual(exitCode, 0);
    });
});
