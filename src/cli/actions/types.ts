import { ManifestGenerator, toTypeDefinitions } from '../../index.js';
import { resolve } from 'path';
import { action, emit } from './run.js';

/**
 * `banira types <files...>` — generate a self-contained `.d.ts` from the
 * components' manifest that augments `HTMLElementTagNameMap` (and, with `--jsx`,
 * `JSX.IntrinsicElements`) so the custom elements are typed for consumers.
 */
export const types = action(
  'Failed to generate type definitions',
  async (files: string[], options: { output?: string; jsx?: boolean } = {}) => {
    const pkg = new ManifestGenerator(files.map((f) => resolve(f))).generate();
    const dts = toTypeDefinitions(pkg, options.jsx ? { jsx: true } : {});

    const outPath = await emit(dts, options.output);
    if (outPath) console.log(`Type definitions written to ${outPath}`);
  }
);
