import { createServer, type Server, type ServerResponse } from 'http';
import { watch as fsWatch, realpathSync } from 'fs';
import { readFile, stat, realpath } from 'fs/promises';
import { resolve, join, extname, normalize, sep } from 'path';
import { transpileToEsm } from '../../transpile-module.js';
import { HMR_CLIENT_SCRIPT, hmrMessage } from '../../hmr-client.js';

export interface ServeOptions {
  port?: string | number;
  /** Host/interface to bind. Defaults to 127.0.0.1; pass 0.0.0.0 to expose on the network. */
  host?: string;
  /**
   * Transpile TypeScript on the fly: serve `.ts` files as ES modules and map a
   * request for `foo.js` to a sibling `foo.ts` when no compiled `foo.js` exists,
   * so the dev loop needs no separate compile step.
   */
  transformTs?: boolean;
  /**
   * Inject the custom-element HMR runtime instead of plain full-page reload, so
   * `hmr:<module>` pushes hot-swap a component's implementation in place (#8).
   * Falls back to a full reload for any non-module change.
   */
  hmr?: boolean;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const LIVE_RELOAD = `<script>
new EventSource('/__livereload').onmessage = () => location.reload();
</script>`;

// HMR variant: installs the custom-element hot-swap runtime, which itself opens
// the EventSource and applies `hmr:<url>` updates (falling back to full reload).
const HMR_RELOAD = `<script type="module">${HMR_CLIENT_SCRIPT}</script>`;

// This is a dev server with live reload: every served file may change between
// requests, so the browser must never serve a cached copy. Without this the
// recompiled module is fetched from cache after a live-reload refresh and the
// change appears not to take effect.
const NO_STORE = 'no-store';

/** An http.Server that can also push a live-reload to connected browsers. */
export interface ReloadableServer extends Server {
  /** Push a reload to every connected live-reload client; returns the count. */
  reload(): number;
  /**
   * Push a hot-module update for `moduleUrl` to connected clients (HMR mode),
   * returning the count. The client re-imports the module and re-registers the
   * component in place; with `hmr` off this is equivalent to a full {@link reload}.
   */
  hmrUpdate(moduleUrl: string): number;
}

/**
 * `banira serve [root]` — a tiny static file server for the dev loop, with
 * live reload: HTML responses get a small EventSource snippet injected, and any
 * change under the served root pushes a reload. Pair it with `banira watch` to
 * recompile-and-refresh.
 *
 * Binds 127.0.0.1 by default so the dev server is not reachable from the
 * network; pass `host: '0.0.0.0'` (CLI: `--host`) to expose it deliberately.
 *
 * @returns The running server, augmented with a {@link ReloadableServer.reload}
 *   method so callers (e.g. `dev`) can push a reload directly after a successful
 *   recompile instead of relying on the file watcher noticing the output.
 */
export const serve = (root: string = '.', options: ServeOptions = {}): ReloadableServer => {
  const rootDir = resolve(root);
  // Resolve symlinks in the root once, so served files can be checked against
  // the real root (a symlinked root like /tmp on macOS is still fine).
  const realRootDir = realpathSync(rootDir);
  const port = Number(options.port ?? 8080);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port "${options.port}": expected a number between 0 and 65535`);
  }
  const host = options.host ?? '127.0.0.1';
  const clients = new Set<ServerResponse>();

  const server = createServer(async (req, res) => {
    const url = (req.url ?? '/').split('?')[0]!;

    if (url === '/__livereload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    // Resolve the request to a path inside rootDir, rejecting traversal.
    // decodeURIComponent throws on a malformed escape (e.g. `/%ZZ`); treat that
    // as a bad request rather than letting it crash the handler.
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad Request');
      return;
    }
    let filePath = join(rootDir, normalize(decodedUrl));
    if (filePath !== rootDir && !filePath.startsWith(rootDir + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    // On-the-fly TypeScript: serve `.ts` as JS, and map `foo.js` to `foo.ts`
    // when no compiled `foo.js` is present, so no separate compile step is needed.
    let transform = false;
    if (options.transformTs) {
      const reqExt = extname(filePath).toLowerCase();
      if (reqExt === '.ts') {
        transform = true;
      } else if (reqExt === '.js') {
        const jsExists = await stat(filePath).then((s) => s.isFile()).catch(() => false);
        if (!jsExists) {
          const tsPath = filePath.slice(0, -3) + '.ts';
          const tsExists = await stat(tsPath).then((s) => s.isFile()).catch(() => false);
          if (tsExists) {
            filePath = tsPath;
            transform = true;
          }
        }
      }
    }

    try {
      const stats = await stat(filePath);
      if (stats.isDirectory()) filePath = join(filePath, 'index.html');

      // Re-check after resolving symlinks: a link inside the root pointing
      // outside it passes the string-prefix test above but not this one.
      const realFilePath = await realpath(filePath);
      if (realFilePath !== realRootDir && !realFilePath.startsWith(realRootDir + sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      if (transform) {
        const source = await readFile(realFilePath, 'utf8');
        const js = transpileToEsm(source, realFilePath);
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': NO_STORE }).end(js);
        return;
      }

      const ext = extname(filePath).toLowerCase();
      const type = MIME[ext] ?? 'application/octet-stream';

      if (ext === '.html') {
        const snippet = options.hmr ? HMR_RELOAD : LIVE_RELOAD;
        const html = (await readFile(realFilePath, 'utf8')).replace(/<\/body>/i, `${snippet}</body>`);
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': NO_STORE }).end(html);
      } else {
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': NO_STORE }).end(await readFile(realFilePath));
      }
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });

  // Push a reload to every connected live-reload client. Returns how many were
  // notified, so callers can log/observe whether any browser is listening.
  const reload = (): number => {
    for (const client of clients) client.write('data: reload\n\n');
    return clients.size;
  };

  // Push a hot-module update. In HMR mode the client swaps the component in
  // place; otherwise the client treats any message as a full reload.
  const hmrUpdate = (moduleUrl: string): number => {
    const payload = options.hmr ? hmrMessage(moduleUrl) : 'reload';
    for (const client of clients) client.write(`data: ${payload}\n\n`);
    return clients.size;
  };

  // Debounced reload when the served tree changes on disk. This still covers
  // plain `serve` (no compiler) and any out-of-band edits under the root.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const notify = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(reload, 50);
  };
  let watcher;
  try {
    watcher = fsWatch(rootDir, { recursive: true }, notify);
  } catch {
    watcher = fsWatch(rootDir, notify);
  }

  // Tear down the watcher, pending timer and any open SSE connections when the
  // server closes, so the process can exit cleanly.
  server.on('close', () => {
    watcher.close();
    if (timer) clearTimeout(timer);
    for (const client of clients) client.end();
    clients.clear();
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    watcher.close();
    if (error.code === 'EADDRINUSE') {
      console.error(`banira serve: port ${port} is already in use (try --port <number>)`);
    } else {
      console.error(`banira serve: ${error.message}`);
    }
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    const displayHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
    console.log(`banira serving ${rootDir} at http://${displayHost}:${port}  (live reload on, bound to ${host})`);
  });

  const reloadable = server as ReloadableServer;
  reloadable.reload = reload;
  reloadable.hmrUpdate = hmrUpdate;
  return reloadable;
};
