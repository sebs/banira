import { DocGen } from 'banira';
import { resolve, basename } from 'path';

export const doc = async (file: string) => {
  try {
    const filePath = resolve(file);
    const tagName = basename(filePath, '.ts');
    const docGen = new DocGen(tagName);
    const parsed = await docGen.parseDoc(filePath);
    const doc = docGen.renderDocs(parsed);
    console.log(doc)
  } catch (error) {
    console.error('Failed to generate documentation:', error);
    process.exit(1);
  }
}
