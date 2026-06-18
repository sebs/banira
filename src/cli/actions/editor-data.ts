import { ManifestGenerator, toVsCodeHtmlData, toVsCodeCssData, toWebTypes } from '../../index.js';
import { readFileSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, join } from 'path';
import { action } from './run.js';

/** Reads `name`/`version` from the nearest package.json, falling back to sensible defaults. */
function packageInfo(): { name: string; version: string } {
  try {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
    return { name: pkg.name ?? 'components', version: pkg.version ?? '0.0.0' };
  } catch {
    return { name: 'components', version: '0.0.0' };
  }
}

/**
 * `banira editor-data <files...>` — generate editor IntelliSense data from the
 * components' manifest: VS Code HTML and CSS custom-data files plus a JetBrains
 * web-types file, all written to the output directory.
 */
export const editorData = action(
  'Failed to generate editor data',
  async (files: string[], options: { outDir?: string } = {}) => {
    const pkg = new ManifestGenerator(files.map((f) => resolve(f))).generate();
    const info = packageInfo();
    const outDir = resolve(options.outDir ?? '.');
    await mkdir(outDir, { recursive: true });

    const artifacts: [string, unknown][] = [
      ['vscode.html-custom-data.json', toVsCodeHtmlData(pkg)],
      ['vscode.css-custom-data.json', toVsCodeCssData(pkg)],
      ['web-types.json', toWebTypes(pkg, info)],
    ];

    for (const [fileName, data] of artifacts) {
      const outPath = join(outDir, fileName);
      await writeFile(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`Wrote ${outPath}`);
    }
  }
);
