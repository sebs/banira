import { ManifestGenerator, manifestToMarkdown, validateManifest, formatValidationIssues } from '../../index.js';
import { resolve } from 'path';
import { action, emit, plural } from './run.js';

/**
 * `banira manifest <files...>` — emit a Custom Elements Manifest
 * (custom-elements.json) for the given component source files. With `--md` the
 * output is Markdown API documentation instead of JSON; with `--validate` the
 * generated manifest is checked and a report is printed.
 */
export const manifest = action(
  'Failed to generate manifest',
  async (files: string[], options: { output?: string; md?: boolean; validate?: boolean } = {}) => {
    const pkg = new ManifestGenerator(files.map((f) => resolve(f))).generate();

    if (options.validate) {
      const issues = validateManifest(pkg);
      console.log(formatValidationIssues(issues));
      if (issues.some((i) => i.severity === 'error')) process.exit(1);
      return;
    }

    const output = options.md ? manifestToMarkdown(pkg) : JSON.stringify(pkg, null, 2);
    const outPath = await emit(output, options.output);
    if (outPath) {
      const count = pkg.modules.flatMap((m) => m.declarations).length;
      const what = options.md ? 'Markdown docs' : 'Manifest';
      console.log(`${what} written to ${outPath} (${plural(count, 'custom element')})`);
    }
  }
);
