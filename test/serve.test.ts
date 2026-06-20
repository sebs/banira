import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { get, type Server } from 'http';
import type { AddressInfo } from 'net';
import { mkdtempSync, symlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { serve, type ReloadableServer } from '../src/cli/actions/serve.js';

const PORT = 8137;
const base = `http://127.0.0.1:${PORT}`;

describe('serve (static dev server)', () => {
    let server: ReloadableServer;

    before(async () => {
        // Serve the examples directory, which contains my-circle/demo/index.html.
        server = serve('examples/my-circle/demo', { port: PORT });
        await new Promise<void>((resolve) => server.once('listening', resolve));
    });

    after(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('serves index.html for the root and injects the live-reload snippet', async () => {
        const res = await fetch(`${base}/`);
        assert.strictEqual(res.status, 200);
        assert.match(res.headers.get('content-type') ?? '', /text\/html/);
        const body = await res.text();
        assert.match(body, /EventSource\('\/__livereload'\)/);
    });

    it('serves static assets with a sensible content-type', async () => {
        const res = await fetch(`${base}/index.html`);
        assert.strictEqual(res.status, 200);
        assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    });

    it('serves files with no-store so live reload picks up recompiles', async () => {
        // Without this the browser serves the cached module after a reload and
        // the recompiled change appears not to take effect.
        const html = await fetch(`${base}/`);
        assert.strictEqual(html.headers.get('cache-control'), 'no-store');
        const asset = await fetch(`${base}/index.html`);
        assert.strictEqual(asset.headers.get('cache-control'), 'no-store');
    });

    it('reload() pushes to connected live-reload clients', async () => {
        // Connect like the browser's EventSource does, then trigger reload()
        // directly (what dev calls after a successful recompile).
        const received = await new Promise<string>((resolveMsg, reject) => {
            const req = get(`${base}/__livereload`, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk: string) => {
                    if (chunk.includes('data: reload')) {
                        req.destroy();
                        resolveMsg(chunk.trim());
                    }
                });
            });
            req.on('error', reject);
            // Give the SSE connection a tick to register, then push.
            setTimeout(() => {
                const n = server.reload();
                assert.strictEqual(n, 1, 'reload() should report one connected client');
            }, 100);
        });
        assert.match(received, /data: reload/);
    });

    it('returns 404 for missing files', async () => {
        const res = await fetch(`${base}/does-not-exist.js`);
        assert.strictEqual(res.status, 404);
    });

    it('rejects path traversal', async () => {
        const res = await fetch(`${base}/../../package.json`, { redirect: 'manual' });
        assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`);
    });

    it('returns 400 for a malformed percent-escape instead of crashing', async () => {
        // decodeURIComponent throws on `%ZZ`; the handler must not die.
        const res = await fetch(`${base}/%ZZ`);
        assert.strictEqual(res.status, 400);
        // The server is still up and serving afterwards.
        const ok = await fetch(`${base}/`);
        assert.strictEqual(ok.status, 200);
    });

    it('binds to 127.0.0.1 by default', () => {
        const address = server.address() as AddressInfo;
        assert.strictEqual(address.address, '127.0.0.1');
    });

    it('rejects an invalid port up front', () => {
        assert.throws(() => serve('examples/my-circle/demo', { port: 'not-a-port' }), /Invalid port/);
        assert.throws(() => serve('examples/my-circle/demo', { port: 70000 }), /Invalid port/);
    });
});

describe('serve (HMR mode, issue #8)', () => {
    const HMR_PORT = 8139;
    const hmrBase = `http://127.0.0.1:${HMR_PORT}`;
    let server: ReloadableServer;

    before(async () => {
        server = serve('examples/my-circle/demo', { port: HMR_PORT, hmr: true });
        await new Promise<void>((resolve) => server.once('listening', resolve));
    });

    after(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('injects the HMR runtime instead of the plain reload snippet', async () => {
        const body = await (await fetch(`${hmrBase}/`)).text();
        assert.match(body, /__baniraHmr/, 'HMR runtime should be injected');
        assert.match(body, /type="module"/);
    });

    it('hmrUpdate pushes an hmr:<url> payload to connected clients', async () => {
        const received = await new Promise<string>((resolveMsg, reject) => {
            const req = get(`${hmrBase}/__livereload`, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk: string) => {
                    if (chunk.includes('hmr:')) {
                        req.destroy();
                        resolveMsg(chunk.trim());
                    }
                });
            });
            req.on('error', reject);
            setTimeout(() => {
                const n = server.hmrUpdate('/dist/my-circle.js');
                assert.strictEqual(n, 1, 'hmrUpdate should report one connected client');
            }, 100);
        });
        assert.match(received, /data: hmr:\/dist\/my-circle\.js/);
    });
});

describe('serve (symlink escape)', () => {
    const SYMLINK_PORT = 8138;
    let server: Server;
    let dir: string;

    before(async () => {
        // A served root containing a symlink that points outside of it.
        dir = mkdtempSync(join(tmpdir(), 'banira-serve-'));
        symlinkSync(resolve('package.json'), join(dir, 'escape.json'));
        server = serve(dir, { port: SYMLINK_PORT });
        await new Promise<void>((resolveListen) => server.once('listening', resolveListen));
    });

    after(async () => {
        await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
        rmSync(dir, { recursive: true, force: true });
    });

    it('refuses to serve a symlink pointing outside the root', async () => {
        const res = await fetch(`http://127.0.0.1:${SYMLINK_PORT}/escape.json`);
        assert.strictEqual(res.status, 403);
    });
});
