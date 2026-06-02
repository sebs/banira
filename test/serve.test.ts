import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import type { Server } from 'http';
import { serve } from '../src/cli/actions/serve.js';

const PORT = 8137;
const base = `http://localhost:${PORT}`;

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
});
