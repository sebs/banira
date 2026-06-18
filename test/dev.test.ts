import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'node:http';
import { dev } from '../src/cli/actions/dev.js';

const PORT = 8146;
const PORT_BUSY = 8147;

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

    it('tears down the watcher (no hang) when the port is already in use', async () => {
        // Occupy the port so serve() can't bind it.
        const blocker = createServer((_req, res) => res.end());
        await new Promise<void>((resolve) => blocker.listen(PORT_BUSY, '127.0.0.1', resolve));
        // serve() sets process.exitCode = 1 on a listen error; don't let that
        // leak out and fail the whole suite.
        const prevExitCode = process.exitCode;
        try {
            const handle = dev(['examples/my-circle/my-circle.ts'], {
                outDir: 'dist/.dev-busy-out',
                root: 'examples/my-circle/demo',
                port: PORT_BUSY,
            });
            const err = await new Promise<NodeJS.ErrnoException>((resolve) =>
                handle.server.once('error', resolve)
            );
            assert.strictEqual(err.code, 'EADDRINUSE');
            // The fix: dev must tear itself down rather than leave the compile
            // watcher running. Without it, `closed` never resolves and this
            // races to the timeout.
            let timer: ReturnType<typeof setTimeout>;
            await Promise.race([
                handle.closed,
                new Promise<void>((_resolve, reject) => {
                    timer = setTimeout(() => reject(new Error('dev did not tear down on EADDRINUSE')), 2000);
                }),
            ]).finally(() => clearTimeout(timer!));
        } finally {
            process.exitCode = prevExitCode;
            await new Promise<void>((resolve) => blocker.close(() => resolve()));
        }
    });
});
