import { scaffoldComponent } from '../../index.js';
import { writeFile, mkdir, access } from 'fs/promises';
import { resolve, join } from 'path';

/**
 * `banira init <tag-name> [dir]` — scaffold a starter vanilla web component
 * (TypeScript source + demo page) into `dir` (default `.`). Existing files are
 * left untouched unless `--force` is given.
 */
export const init = async (tagName: string, dir: string = '.', options: { force?: boolean } = {}) => {
  try {
    const files = scaffoldComponent(tagName);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to scaffold component: ${message}`);
    process.exit(1);
  }
};
