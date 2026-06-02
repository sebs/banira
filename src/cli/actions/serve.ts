import { createServer, type Server, type ServerResponse } from 'http';
import { watch as fsWatch } from 'fs';
import { readFile, stat } from 'fs/promises';
import { resolve, join, extname, normalize, sep } from 'path';

export interface ServeOptions {
  port?: string | number;
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

/**
 * `banira serve [root]` — a tiny static file server for the dev loop, with
 * live reload: HTML responses get a small EventSource snippet injected, and any
 * change under the served root pushes a reload. Pair it with `banira watch` to
 * recompile-and-refresh.
 *
 * @returns The running http.Server (used by tests to close it).
 */
export const serve = (root: string = '.', options: ServeOptions = {}): Server => {
  const rootDir = resolve(root);
  const port = Number(options.port ?? 8080);
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
    let filePath = join(rootDir, normalize(decodeURIComponent(url)));
    if (filePath !== rootDir && !filePath.startsWith(rootDir + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const stats = await stat(filePath);
      if (stats.isDirectory()) filePath = join(filePath, 'index.html');
      const ext = extname(filePath).toLowerCase();
      const type = MIME[ext] ?? 'application/octet-stream';

      if (ext === '.html') {
        const html = (await readFile(filePath, 'utf8')).replace(/<\/body>/i, `${LIVE_RELOAD}</body>`);
        res.writeHead(200, { 'Content-Type': type }).end(html);
      } else {
        res.writeHead(200, { 'Content-Type': type }).end(await readFile(filePath));
      }
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });

  // Push a reload to all connected clients when the served tree changes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const notify = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      for (const client of clients) client.write('data: reload\n\n');
    }, 50);
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

  server.listen(port, () => {
    console.log(`banira serving ${rootDir} at http://localhost:${port}  (live reload on)`);
  });

  return server;
};
