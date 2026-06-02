import { ManifestGenerator } from '../../index.js';
import { resolve, dirname } from 'path';
import { writeFile, mkdir } from 'fs/promises';

/**
 * `banira manifest <files...>` — emit a Custom Elements Manifest
 * (custom-elements.json) for the given component source files.
 */
export const manifest = async (files: string[], options: { output?: string } = {}) => {
  try {
    const generator = new ManifestGenerator(files.map((f) => resolve(f)));
    const pkg = generator.generate();
    const json = JSON.stringify(pkg, null, 2);

    if (options.output) {
      const outPath = resolve(options.output);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, json + '\n', 'utf8');
      const count = pkg.modules.flatMap((m) => m.declarations).length;
      console.log(`Manifest written to ${outPath} (${count} custom element${count === 1 ? '' : 's'})`);
    } else {
      console.log(json);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate manifest: ${message}`);
    process.exit(1);
  }
};
