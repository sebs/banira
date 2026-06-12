import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { mkdtempSync, symlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { serve } from '../src/cli/actions/serve.js';

const PORT = 8137;
const base = `http://127.0.0.1:${PORT}`;

describe('serve (static dev server)', () => {
    let server: Server;

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

    it('returns 404 for missing files', async () => {
        const res = await fetch(`${base}/does-not-exist.js`);
        assert.strictEqual(res.status, 404);
    });

    it('rejects path traversal', async () => {
        const res = await fetch(`${base}/../../package.json`, { redirect: 'manual' });
        assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`);
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
