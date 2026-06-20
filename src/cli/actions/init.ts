import { scaffoldComponent } from '../../index.js';
import { writeFile, mkdir, access } from 'fs/promises';
import { resolve, join } from 'path';
import { action } from './run.js';

/**
 * `banira init <tag-name> [dir]` — scaffold a starter vanilla web component
 * (TypeScript source + demo page) into `dir` (default `.`). Existing files are
 * left untouched unless `--force` is given.
 */
export const init = action(
  'Failed to scaffold component',
  async (
    tagName: string,
    dir: string = '.',
    options: { force?: boolean; formAssociated?: boolean; aria?: boolean } = {}
  ) => {
    const files = scaffoldComponent(tagName, {
      formAssociated: Boolean(options.formAssociated),
      aria: Boolean(options.aria),
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
    console.log(`\nNext: banira dev ${join(dir, `${tagName}.ts`)} -o ${join(dir, 'dist')}`);
  }
);
