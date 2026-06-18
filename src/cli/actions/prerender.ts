import { prerenderManifest } from '../../index.js';
import { resolve } from 'path';
import { action, emit, plural } from './run.js';

/**
 * `banira prerender <files...>` — render the components to static HTML using
 * Declarative Shadow DOM (`<template shadowrootmode="open">`), so they display
 * (shadow DOM and all) before any JavaScript runs. Writes the concatenated
 * markup to stdout unless `-o` is given.
 */
export const prerender = action(
  'Failed to prerender',
  async (files: string[], options: { output?: string } = {}) => {
    const results = await prerenderManifest(files.map((f) => resolve(f)));
    const html = results.map((r) => r.html).join('\n');

    const outPath = await emit(html, options.output);
    if (outPath) console.log(`Prerendered ${plural(results.length, 'element')} to ${outPath}`);
  }
);
