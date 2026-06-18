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
  const stopWatch = watch(files, compileOptions);

  const root = options.root ?? options.outDir ?? '.';
  const serveOptions: ServeOptions = {};
  if (options.port !== undefined) serveOptions.port = options.port;
  if (options.host !== undefined) serveOptions.host = options.host;
  if (options.transformTs !== undefined) serveOptions.transformTs = options.transformTs;
  const server = serve(root, serveOptions);

  const stop = (): void => {
    stopWatch();
    server.close();
  };

  const shutdown = (): void => {
    stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { stop, server };
};
