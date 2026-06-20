import { ManifestGenerator, manifestToStories } from '../../index.js';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, join } from 'path';
import { action, plural } from './run.js';

/**
 * `banira stories <files...>` — generate Storybook Component Story Format
 * (`*.stories.js`) for each component, with an `argTypes` controls panel derived
 * from its attributes (string-literal unions become `select` options) and events
 * (mapped to actions). Pair with `@storybook/web-components`; in
 * `.storybook/preview.js`, register the manifest via `setCustomElementsManifest`
 * for richer docs.
 */
export const stories = action(
  'Failed to generate stories',
  async (files: string[], options: { outDir?: string; importPath?: string } = {}) => {
    const pkg = new ManifestGenerator(files.map((f) => resolve(f))).generate();
    const generated = manifestToStories(pkg, options.importPath ? { importPath: options.importPath } : {});

    if (generated.length === 0) {
      console.log('No custom elements found; no stories written.');
      return;
    }

    const outDir = resolve(options.outDir ?? '.');
    await mkdir(outDir, { recursive: true });
    for (const { fileName, source } of generated) {
      const outPath = join(outDir, fileName);
      await writeFile(outPath, source, 'utf8');
      console.log(`Wrote ${outPath}`);
    }
    console.log(`Generated ${plural(generated.length, 'story file')}.`);
  }
);
