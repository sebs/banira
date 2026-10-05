import { describe, it } from 'node:test';
import assert from 'node:assert';
import { get } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import {
    installErrorOverlay,
    toOverlayDiagnostics,
    errorOverlayMessage,
    HMR_CLIENT_SCRIPT,
} from '../src/index.js';
import type { ErrorOverlay } from '../src/index.js';
import { compileFiles } from '../src/cli/actions/compile.js';
import { serve, type ReloadableServer } from '../src/cli/actions/serve.js';
import { dev } from '../src/cli/actions/dev.js';

type OverlayWindow = Window & typeof globalThis & { __baniraErrorOverlay?: ErrorOverlay };

function freshWindow(): OverlayWindow {
    return new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' }).window as unknown as OverlayWindow;
}

function overlayRoot(win: OverlayWindow): ShadowRoot | null | undefined {
    return win.document.querySelector('[data-banira-error-overlay]')?.shadowRoot;
}

/** Collects SSE `data:` lines from /__livereload until `until` matches. */
function readSse(url: string, until: RegExp, onOpen?: () => void): Promise<string> {
    return new Promise((resolveMsg, reject) => {
        let buffer = '';
        const req = get(url, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
                buffer += chunk;
                if (until.test(buffer)) {
                    req.destroy();
                    resolveMsg(buffer);
                }
            });
            onOpen?.();
        });
        req.on('error', reject);
    });
}

describe('error overlay (issue #46)', () => {
    it('converts compiler diagnostics to file/line/column/message', () => {
        const dir = mkdtempSync(join(tmpdir(), 'banira-overlay-'));
        try {
            const file = join(dir, 'broken.ts');
            writeFileSync(file, 'const n: number = "nope";\n', 'utf8');
            const { ok, errors } = compileFiles([file], { outDir: join(dir, 'dist') });
            assert.strictEqual(ok, false);
            const [d] = toOverlayDiagnostics(errors, dir);
            assert.strictEqual(d!.file, 'broken.ts');
            assert.strictEqual(d!.line, 1);
            assert.strictEqual(d!.column, 7);
            assert.match(d!.message, /not assignable to type 'number'/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('builds a single-line error: payload', () => {
        const payload = errorOverlayMessage([{ message: 'line one\nline two' }]);
        assert.ok(payload.startsWith('error:'));
        assert.ok(!payload.includes('\n'), 'SSE data must fit on one line');
        assert.deepStrictEqual(JSON.parse(payload.slice(6)), [{ message: 'line one\nline two' }]);
    });

    it('renders diagnostics in a shadow-root overlay as text, never HTML', () => {
        const win = freshWindow();
        const overlay = installErrorOverlay(win);
        overlay.show([
            { file: 'src/a.ts', line: 3, column: 9, message: '<img src=x onerror=alert(1)> is wrong' },
            { message: 'global error' },
        ]);
        const root = overlayRoot(win)!;
        assert.ok(root, 'overlay host with a shadow root is appended to the body');
        assert.match(root.querySelector('.title')!.textContent!, /Compilation failed: 2 errors/);
        assert.strictEqual(root.querySelector('.loc')!.textContent, 'src/a.ts:3:9');
        assert.strictEqual(root.querySelector('img'), null, 'messages must not be parsed as HTML');
        assert.match(root.querySelectorAll('.msg')[0]!.textContent!, /<img src=x/);
        assert.strictEqual(root.querySelector('[role="alertdialog"]')?.getAttribute('aria-label'), 'Compilation errors');
    });

    it('replaces on re-show and dismisses via the close button, Escape, or clear()', () => {
        const win = freshWindow();
        const overlay = installErrorOverlay(win);
        overlay.show([{ message: 'one' }]);
        overlay.show([{ message: 'two' }]);
        assert.strictEqual(win.document.querySelectorAll('[data-banira-error-overlay]').length, 1);

        (overlayRoot(win)!.querySelector('.close') as HTMLElement).click();
        assert.strictEqual(overlayRoot(win), undefined);

        overlay.show([{ message: 'three' }]);
        win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
        assert.strictEqual(overlayRoot(win), undefined);

        overlay.show([{ message: 'four' }]);
        overlay.clear();
        assert.strictEqual(overlayRoot(win), undefined);
    });

    it('is idempotent — installing twice returns the same runtime', () => {
        const win = freshWindow();
        assert.strictEqual(installErrorOverlay(win), installErrorOverlay(win));
    });

    it('the HMR client shows error: messages and clears the overlay on hmr: updates', () => {
        assert.match(HMR_CLIENT_SCRIPT, /indexOf\('error:'\) === 0/);
        assert.match(HMR_CLIENT_SCRIPT, /__baniraOverlay\.clear\(\)/);
    });
});

describe('error overlay over the live-reload channel (issue #46)', () => {
    const PORT = 8148;
    const base = `http://127.0.0.1:${PORT}`;

    it('the injected live-reload snippet shows error: messages and reloads otherwise', async () => {
        const server = serve('examples/my-circle/demo', { port: PORT });
        await new Promise<void>((r) => server.once('listening', r));
        try {
            const html = await (await fetch(`${base}/`)).text();
            const start = html.lastIndexOf('<script>{');
            const script = start >= 0 ? html.slice(start + '<script>'.length, html.indexOf('</script>', start)) : undefined;
            assert.ok(script, 'live-reload snippet injected before </body>');

            // Run the real snippet against a stub EventSource.
            const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/', runScripts: 'outside-only' });
            const win = dom.window as unknown as OverlayWindow & Record<string, unknown>;
            let source: { onmessage?: (e: { data: string }) => void } = {};
            win.EventSource = function (this: typeof source) { source = this; } as never;
            // Under tsx (esbuild keepNames) Function#toString contains __name(); the tsc build doesn't.
            win.__name = (f: unknown) => f;
            win.eval(script.replace(/location\.reload\(\)/g, 'window.__reloads = (window.__reloads || 0) + 1'));

            source.onmessage!({ data: errorOverlayMessage([{ file: 'x.ts', line: 1, column: 1, message: 'boom' }]) });
            assert.match(overlayRoot(win)!.querySelector('.msg')!.textContent!, /boom/);
            source.onmessage!({ data: 'reload' });
            assert.strictEqual(win.__reloads, 1);
        } finally {
            await new Promise<void>((r) => server.close(() => r()));
        }
    });

    it('showErrors pushes to connected tabs and replays to new ones until clearErrors', async () => {
        const server: ReloadableServer = serve('examples/my-circle/demo', { port: PORT + 1 });
        const url = `http://127.0.0.1:${PORT + 1}/__livereload`;
        await new Promise<void>((r) => server.once('listening', r));
        try {
            const pushed = await readSse(url, /data: error:/, () => {
                setTimeout(() => assert.strictEqual(server.showErrors([{ message: 'bad' }]), 1), 50);
            });
            assert.match(pushed, /data: error:\[\{"message":"bad"\}\]/);

            // A tab connecting later (e.g. after the watcher's reload) gets the error replayed.
            const replayed = await readSse(url, /data: error:/);
            assert.match(replayed, /"bad"/);

            server.clearErrors();
            const clean = await readSse(url, /data: reload/, () => setTimeout(() => server.reload(), 50));
            assert.doesNotMatch(clean, /error:/);
        } finally {
            await new Promise<void>((r) => server.close(() => r()));
        }
    });

    it('dev pushes compile errors and clears them on the next successful compile', { timeout: 20000 }, async () => {
        // Source outside the served root, so saving it doesn't trigger serve's
        // file-watcher reload before the recompile has cleared the error.
        const dir = mkdtempSync(join(tmpdir(), 'banira-dev-overlay-'));
        const www = join(dir, 'www');
        mkdirSync(www);
        const file = join(dir, 'bad-el.ts');
        writeFileSync(file, 'const n: number = "nope";\nexport {};\n', 'utf8');
        writeFileSync(join(www, 'index.html'), '<!doctype html><body></body>', 'utf8');
        const handle = dev([file], { outDir: join(www, 'dist'), root: www, port: PORT + 2 });
        const url = `http://127.0.0.1:${PORT + 2}/__livereload`;
        try {
            await new Promise<void>((r) => handle.server.once('listening', r));
            // Let the file-watcher reload for the initial (errored) emit into www/dist settle.
            await new Promise((r) => setTimeout(r, 300));
            // The initial compile already failed, so the error is replayed on connect.
            const failed = await readSse(url, /data: error:/);
            const [d] = JSON.parse(/data: error:(.*)/.exec(failed)![1]!);
            assert.strictEqual(resolve(d.file), file);
            assert.strictEqual(d.line, 1);

            // Fix the source: the watcher recompiles, clears the error and reloads.
            const fixed = await readSse(url, /data: reload/, () =>
                setTimeout(() => writeFileSync(file, 'const n: number = 1;\nexport { n };\n', 'utf8'), 100)
            );
            assert.match(fixed, /data: reload/);
            const after = await readSse(url, /data: reload/, () => setTimeout(() => (handle.server as ReloadableServer).reload(), 50));
            assert.doesNotMatch(after, /error:/, 'no error replayed after a successful compile');
        } finally {
            handle.stop();
            await new Promise<void>((r) => handle.server.close(() => r()));
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
