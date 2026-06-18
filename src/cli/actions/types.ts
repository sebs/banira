import { ManifestGenerator, toTypeDefinitions } from '../../index.js';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';

/**
 * `banira types <files...>` — generate a self-contained `.d.ts` from the
 * components' manifest that augments `HTMLElementTagNameMap` (and, with `--jsx`,
 * `JSX.IntrinsicElements`) so the custom elements are typed for consumers.
 */
export const types = async (files: string[], options: { output?: string; jsx?: boolean } = {}) => {
  try {
    const generator = new ManifestGenerator(files.map((f) => resolve(f)));
    const pkg = generator.generate();
    const dts = toTypeDefinitions(pkg, options.jsx ? { jsx: true } : {});

    if (options.output) {
      const outPath = resolve(options.output);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, dts, 'utf8');
      console.log(`Type definitions written to ${outPath}`);
    } else {
      process.stdout.write(dts);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate type definitions: ${message}`);
    process.exit(1);
  }
};
