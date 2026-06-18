import { watch } from './watch.js';
import { serve } from './serve.js';
import type { CompileOptions } from './compile.js';
import type { ServeOptions } from './serve.js';
import type { Server } from 'http';

export interface DevOptions {
  /** tsconfig.json whose options override the compiler defaults. */
  project?: string;
  /** Directory to write compiled output to. */
  outDir?: string;
  /** Directory to serve (defaults to the output dir, or '.'). */
  root?: string;
  port?: string | number;
  host?: string;
  /** Serve TypeScript transpiled on the fly (see {@link ServeOptions.transformTs}). */
  transformTs?: boolean;
}

export interface DevHandle {
  stop: () => void;
  server: Server;
  /** Resolves once dev has fully torn down — via {@link stop} or a fatal server error. */
  closed: Promise<void>;
}

/**
 * `banira dev <files...>` — the one-command dev loop: compile-on-change
 * (`watch`) and a live-reload static server (`serve`) running together, so a
 * source edit recompiles and the browser refreshes. The served root defaults to
 * the output directory.
 *
 * @returns A handle with the running server and a `stop()` that tears both down
 *   (used by tests).
 */
export const dev = (files: string[], options: DevOptions = {}): DevHandle => {
  const compileOptions: CompileOptions = {};
  if (options.project !== undefined) compileOptions.project = options.project;
  if (options.outDir !== undefined) compileOptions.outDir = options.outDir;

  const root = options.root ?? options.outDir ?? '.';
  const serveOptions: ServeOptions = {};
  if (options.port !== undefined) serveOptions.port = options.port;
  if (options.host !== undefined) serveOptions.host = options.host;
  if (options.transformTs !== undefined) serveOptions.transformTs = options.transformTs;
  const server = serve(root, serveOptions);

  // Drive the browser reload off the compile result, not a second file watcher:
  // after every successful recompile, push a reload directly to connected tabs.
  // This is far more reliable than hoping serve's directory watcher notices the
  // freshly written output, and the log makes it visible that a reload was sent.
  const stopWatch = watch(files, compileOptions, (result) => {
    if (!result.ok) return;
    const n = server.reload();
    if (n > 0) console.log(`  ↻ reloaded ${n} browser tab(s)`);
  });

  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    stopWatch();
    server.close(() => resolveClosed());
    // close()'s callback won't fire if the server never started listening
    // (e.g. the port was in use), so resolve unconditionally too.
    resolveClosed();
  };

  // If the server can't start (e.g. EADDRINUSE) serve() logs the reason and
  // sets a non-zero exit code, but the compile watcher would keep the event
  // loop alive — leaving dev hung with no live-reload server. Tear everything
  // down so the process drains and exits with that non-zero code.
  server.on('error', stop);

  const shutdown = (): void => {
    stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { stop, server, closed };
};
