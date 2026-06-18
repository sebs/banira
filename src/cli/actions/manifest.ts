import { ManifestGenerator, manifestToMarkdown, validateManifest, formatValidationIssues } from '../../index.js';
import { resolve, dirname } from 'path';
import { writeFile, mkdir } from 'fs/promises';

/**
 * `banira manifest <files...>` — emit a Custom Elements Manifest
 * (custom-elements.json) for the given component source files. With `--md` the
 * output is Markdown API documentation instead of JSON; with `--validate` the
 * generated manifest is checked and a report is printed.
 */
export const manifest = async (
  files: string[],
  options: { output?: string; md?: boolean; validate?: boolean } = {}
) => {
  try {
    const generator = new ManifestGenerator(files.map((f) => resolve(f)));
    const pkg = generator.generate();

    if (options.validate) {
      const issues = validateManifest(pkg);
      console.log(formatValidationIssues(issues));
      if (issues.some((i) => i.severity === 'error')) process.exit(1);
      return;
    }

    const output = options.md ? manifestToMarkdown(pkg) : JSON.stringify(pkg, null, 2);

    if (options.output) {
      const outPath = resolve(options.output);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, output + (output.endsWith('\n') ? '' : '\n'), 'utf8');
      const count = pkg.modules.flatMap((m) => m.declarations).length;
      console.log(`${options.md ? 'Markdown docs' : 'Manifest'} written to ${outPath} (${count} custom element${count === 1 ? '' : 's'})`);
    } else {
      console.log(output);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate manifest: ${message}`);
    process.exit(1);
  }
};
