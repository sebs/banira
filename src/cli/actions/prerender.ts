import { prerenderManifest } from '../../index.js';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';

/**
 * `banira prerender <files...>` — render the components to static HTML using
 * Declarative Shadow DOM (`<template shadowrootmode="open">`), so they display
 * (shadow DOM and all) before any JavaScript runs. Writes the concatenated
 * markup to stdout unless `-o` is given.
 */
export const prerender = async (files: string[], options: { output?: string } = {}) => {
  try {
    const results = await prerenderManifest(files.map((f) => resolve(f)));
    const html = results.map((r) => r.html).join('\n') + '\n';

    if (options.output) {
      const outPath = resolve(options.output);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, html, 'utf8');
      console.log(`Prerendered ${results.length} element${results.length === 1 ? '' : 's'} to ${outPath}`);
    } else {
      process.stdout.write(html);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to prerender: ${message}`);
    process.exit(1);
  }
};
