import { DocGen, ManifestGenerator } from '../../index.js';
import { resolve, basename, dirname } from 'path';
import { writeFile, mkdir } from 'fs/promises';

export const doc = async (file: string, options: { output?: string } = {}) => {
  try {
    const filePath = resolve(file);

    // Analyze once for the API reference, and use the real registered tag name
    // (falling back to the file name when the component isn't a custom element).
    const declarations = new ManifestGenerator([filePath]).generate().modules.flatMap((m) => m.declarations);
    const declaration = declarations[0];
    const tagName = declaration?.tagName ?? basename(filePath, '.ts');

    const docGen = new DocGen(tagName);
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
