import { scaffoldTheme, parseDesignTokens } from '../../index.js';
import { readFileSync } from 'fs';
import { writeFile, mkdir, access } from 'fs/promises';
import { resolve, join } from 'path';
import { action } from './run.js';

/**
 * `banira theme [dir]` — scaffold a light/dark theming starter: a `theme.css`
 * token contract, a `<theme-toggle>` component, and a demo page. With
 * `--tokens <file>` the light `:root` set is seeded from a DTCG document.
 * Existing files are left untouched unless `--force` is given.
 */
export const theme = action(
  'Failed to scaffold theme',
  async (dir: string = '.', options: { force?: boolean; tag?: string; tokens?: string } = {}) => {
    const imported = options.tokens
      ? parseDesignTokens(JSON.parse(readFileSync(resolve(options.tokens), 'utf8')))
      : undefined;
    const files = scaffoldTheme({
      ...(options.tag ? { tagName: options.tag } : {}),
      ...(imported ? { tokens: imported } : {}),
    });

    const targetDir = resolve(dir);
    await mkdir(targetDir, { recursive: true });

    for (const file of files) {
      const outPath = join(targetDir, file.path);
      if (!options.force) {
        const exists = await access(outPath).then(() => true).catch(() => false);
        if (exists) {
          console.log(`Skipped ${outPath} (already exists; use --force to overwrite)`);
          continue;
        }
      }
      await writeFile(outPath, file.content, 'utf8');
      console.log(`Created ${outPath}`);
    }
    const tag = options.tag ?? 'theme-toggle';
    console.log(`\nNext: banira dev ${join(dir, `${tag}.ts`)} -o ${join(dir, 'dist')} -r ${dir}`);
  }
);
