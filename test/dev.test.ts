import { describe, it } from 'node:test';
import assert from 'node:assert';
import { dev } from '../src/cli/actions/dev.js';

const PORT = 8146;

describe('dev (compile + serve)', () => {
    it('starts a live-reload server alongside the watcher and stops cleanly', async () => {
        const handle = dev(['examples/my-circle/my-circle.ts'], {
            outDir: 'dist/.dev-test-out',
            root: 'examples/my-circle/demo',
            port: PORT,
        });
        try {
            await new Promise<void>((resolve) => handle.server.once('listening', resolve));
            const res = await fetch(`http://127.0.0.1:${PORT}/`);
            assert.strictEqual(res.status, 200);
            const body = await res.text();
            assert.match(body, /EventSource\('\/__livereload'\)/);
        } finally {
            handle.stop();
            await new Promise<void>((resolve) => handle.server.close(() => resolve()));
        }
    });
});
