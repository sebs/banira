import {
  ManifestGenerator,
  manifestToMarkdown,
  validateManifest,
  validateManifestSchema,
  SchemaValidatorUnavailableError,
  formatValidationIssues,
  linkManifestField,
} from '../../index.js';
import { resolve } from 'path';
import { action, emit, plural } from './run.js';

/**
 * `banira manifest <files...>` — emit a Custom Elements Manifest
 * (custom-elements.json) for the given component source files. With `--md` the
 * output is Markdown API documentation instead of JSON; with `--validate` the
 * generated manifest is checked and a report is printed.
 *
 * `--validate` runs banira's fast structural checks and, when the optional
 * `ajv` dependency is installed, also validates the manifest against the
 * official CEM JSON Schema for guaranteed spec-conformance. `--link-package`
 * points the nearest `package.json`'s `customElements` field at the written
 * manifest (the convention IDEs and Storybook use to auto-discover it).
 */
export const manifest = action(
  'Failed to generate manifest',
  async (
    files: string[],
    options: { output?: string; md?: boolean; validate?: boolean; linkPackage?: boolean } = {}
  ) => {
    const pkg = new ManifestGenerator(files.map((f) => resolve(f))).generate();

    if (options.validate) {
      const issues = validateManifest(pkg);
      try {
        issues.push(...(await validateManifestSchema(pkg)));
      } catch (err) {
        if (err instanceof SchemaValidatorUnavailableError) {
          console.log(
            'Note: install ajv (`npm i -D ajv`) to also validate against the official CEM JSON Schema.'
          );
        } else {
          throw err;
        }
      }
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

    if (options.linkPackage) {
      if (options.md) {
        console.log('Skipped --link-package: the customElements field should point at the JSON manifest, not Markdown.');
      } else if (!outPath) {
        console.log('Skipped --link-package: needs an output path (use -o custom-elements.json).');
      } else {
        try {
          const { packageJsonPath, field, changed } = linkManifestField(outPath);
          console.log(
            changed
              ? `Set "customElements": "${field}" in ${packageJsonPath}`
              : `"customElements" already points at "${field}" in ${packageJsonPath}`
          );
        } catch (err) {
          console.log(`Could not link package.json: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }
);
