import { watch } from './watch.js';
import { serve } from './serve.js';
import { resolve, relative, sep } from 'path';
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
  /** Hot-swap components in place instead of full-page reload (see {@link ServeOptions.hmr}). */
  hmr?: boolean;
  /** Inject an import map for bare imports into served HTML (see {@link ServeOptions.importMap}). */
  importMap?: boolean;
}

/** Maps an emitted file path to its served URL relative to the served root. */
function servedUrl(root: string, outputFile: string): string | undefined {
  const rel = relative(resolve(root), resolve(outputFile));
  if (rel.startsWith('..') || rel.includes('\0')) return undefined; // outside the served root
  return '/' + rel.split(sep).join('/');
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
  if (options.hmr !== undefined) serveOptions.hmr = options.hmr;
  if (options.importMap !== undefined) serveOptions.importMap = options.importMap;
  const server = serve(root, serveOptions);

  // Drive the browser update off the compile result, not a second file watcher:
  // after every successful recompile, push directly to connected tabs. This is
  // far more reliable than hoping serve's directory watcher notices the freshly
  // written output, and the log makes it visible that an update was sent.
  const stopWatch = watch(files, compileOptions, (result) => {
    if (!result.ok) return;
    // In HMR mode, push a module update per emitted .js (hot-swap in place);
    // any output that maps outside the served root falls back to a full reload.
    const modules = options.hmr
      ? result.outputs.filter((f) => f.endsWith('.js')).map((f) => servedUrl(root, f)).filter((u): u is string => !!u)
      : [];
    if (modules.length) {
      let n = 0;
      for (const url of modules) n = server.hmrUpdate(url);
      if (n > 0) console.log(`  ↻ hot-updated ${modules.length} module(s) in ${n} browser tab(s)`);
    } else {
      const n = server.reload();
      if (n > 0) console.log(`  ↻ reloaded ${n} browser tab(s)`);
    }
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
