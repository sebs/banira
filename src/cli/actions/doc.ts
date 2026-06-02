import { DocGen, ManifestGenerator, type DocGenOptions, type Stylesheet } from '../../index.js';
import { resolve, basename, dirname } from 'path';
import { existsSync, statSync } from 'fs';
import { writeFile, mkdir, readFile } from 'fs/promises';

export interface DocOptions {
  output?: string;
  scriptSrc?: string;
  stylesheet?: string;
}

/**
 * Resolves the `--stylesheet` value:
 * - `none`            -> no stylesheet
 * - an existing file  -> inlined into the page (offline-safe)
 * - anything else     -> treated as a URL / href
 */
async function resolveStylesheet(value: string): Promise<Stylesheet> {
  if (value === 'none') return 'none';
  const filePath = resolve(value);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return { inline: await readFile(filePath, 'utf8') };
  }
  return { href: value };
}

export const doc = async (file: string, options: DocOptions = {}) => {
  try {
    const filePath = resolve(file);

    // Analyze once for the API reference, and use the real registered tag name
    // (falling back to the file name when the component isn't a custom element).
    const declarations = new ManifestGenerator([filePath]).generate().modules.flatMap((m) => m.declarations);
    const declaration = declarations[0];
    const tagName = declaration?.tagName ?? basename(filePath, '.ts');

    const docOptions: DocGenOptions = {};
    if (options.scriptSrc) docOptions.scriptSrc = options.scriptSrc;
    if (options.stylesheet) docOptions.stylesheet = await resolveStylesheet(options.stylesheet);

    const docGen = new DocGen(tagName, docOptions);
    const parsed = await docGen.parseDoc(filePath);
    const rendered = docGen.renderDocs(parsed, declaration);

    if (options.output) {
      const outPath = resolve(options.output);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, rendered, 'utf8');
      console.log(`Documentation written to ${outPath}`);
    } else {
      console.log(rendered);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate documentation: ${message}`);
    process.exit(1);
  }
}
