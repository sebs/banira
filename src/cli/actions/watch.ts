import { watch as fsWatch } from 'fs';
import { resolve, dirname } from 'path';
import { compileFiles, formatErrors, type CompileOptions } from './compile.js';

/**
 * `banira watch <files...>` — compile once, then recompile whenever a `.ts`
 * file under the inputs' directories changes. Errors are reported without
 * stopping the watcher.
 *
 * @returns A function that stops watching (used by tests).
 */
export const watch = (files: string[], options: CompileOptions): (() => void) => {
  const run = (): void => {
    const stamp = new Date().toLocaleTimeString();
    try {
      const { ok, errors, outputs } = compileFiles(files, options);
      if (!ok) {
        console.error(`[${stamp}] Compilation errors:`);
        console.error(formatErrors(errors));
      } else {
        console.log(`[${stamp}] Compiled ${outputs.length} file(s)`);
      }
    } catch (error) {
      console.error(`[${stamp}] ${error instanceof Error ? error.message : error}`);
    }
  };

  run();

  const dirs = [...new Set(files.map((f) => dirname(resolve(f))))];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 100);
  };

  const watchers = dirs.map((dir) => {
    const onChange = (_event: string, filename: string | Buffer | null) => {
      if (filename && /\.ts$/.test(filename.toString())) schedule();
    };
    try {
      return fsWatch(dir, { recursive: true }, onChange);
    } catch {
      // Older Linux Node builds don't support recursive watching; fall back.
      return fsWatch(dir, onChange);
    }
  });

  console.log(`Watching for changes in: ${dirs.join(', ')}  (Ctrl+C to stop)`);

  return () => {
    if (timer) clearTimeout(timer);
    watchers.forEach((w) => w.close());
  };
};
