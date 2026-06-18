import { watch as fsWatch, watchFile, unwatchFile } from 'fs';
import { resolve, dirname } from 'path';
import { compileFiles, formatErrors, type CompileOptions } from './compile.js';

/** Outcome handed to a {@link watch} caller after each (re)compile. */
export interface WatchResult {
  ok: boolean;
  outputs: string[];
}

/**
 * `banira watch <files...>` — compile once, then recompile whenever a `.ts`
 * file under the inputs' directories changes. Errors are reported without
 * stopping the watcher.
 *
 * Change detection is belt-and-braces: `fs.watch` on the input directories
 * catches edits to siblings/imports and newly added files, while `fs.watchFile`
 * polls each named input directly. The poll is what makes editor saves reliable
 * — `fs.watch` misses them on some editor/OS combinations (atomic saves, new
 * inodes), whereas an mtime poll always sees the write.
 *
 * @param onResult Optional callback invoked after every (re)compile, used by
 *   `dev` to push a browser reload only once compilation actually succeeded.
 * @returns A function that stops watching (used by tests).
 */
export const watch = (
  files: string[],
  options: CompileOptions,
  onResult?: (result: WatchResult) => void
): (() => void) => {
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
      onResult?.({ ok, outputs });
    } catch (error) {
      console.error(`[${stamp}] ${error instanceof Error ? error.message : error}`);
      onResult?.({ ok: false, outputs: [] });
    }
  };

  run();

  const resolved = files.map((f) => resolve(f));
  const dirs = [...new Set(resolved.map((f) => dirname(f)))];
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

  // Poll each named input directly. fs.watch can silently miss an editor's
  // save (atomic write + rename, or a fresh inode); an mtime poll never does.
  const poll = (curr: { mtimeMs: number }, prev: { mtimeMs: number }): void => {
    if (curr.mtimeMs !== prev.mtimeMs) schedule();
  };
  resolved.forEach((file) => watchFile(file, { interval: 200 }, poll));

  console.log(`Watching for changes in: ${dirs.join(', ')}  (Ctrl+C to stop)`);

  return () => {
    if (timer) clearTimeout(timer);
    watchers.forEach((w) => w.close());
    resolved.forEach((file) => unwatchFile(file, poll));
  };
};
