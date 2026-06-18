import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';

/**
 * Wraps a CLI action body so every command shares one error path: on a thrown
 * error it prints `<label>: <message>` to stderr and exits non-zero. The action
 * itself only has to express the happy path.
 *
 * @param label Prefix for the error message, e.g. `'Failed to generate manifest'`.
 */
export const action =
  <A extends unknown[]>(label: string, fn: (...args: A) => void | Promise<void>) =>
  async (...args: A): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      console.error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  };

/**
 * Writes `output` to `outputPath`, or to stdout when no path is given — the
 * shared "write to a file or print" behaviour of the generator commands. A
 * trailing newline is ensured either way.
 *
 * @returns The resolved output path when written to a file (so the caller can
 *   log a tailored message), or `undefined` when printed to stdout.
 */
export const emit = async (output: string, outputPath?: string): Promise<string | undefined> => {
  const text = output.endsWith('\n') ? output : output + '\n';
  if (!outputPath) {
    process.stdout.write(text);
    return undefined;
  }
  const outPath = resolve(outputPath);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, text, 'utf8');
  return outPath;
};

/** `plural(1, 'element')` → `'1 element'`; `plural(3, 'element')` → `'3 elements'`. */
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
