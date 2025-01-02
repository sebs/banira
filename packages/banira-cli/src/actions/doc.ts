import { DocGen } from 'banira';
import { resolve } from 'path';

export const doc = async (file: string) => {
  try {
    const filePath = resolve(file);
    const docGen = new DocGen();
    const documentation = await docGen.parseDoc(filePath);
    console.log(documentation);
  } catch (error) {
    console.error('Failed to generate documentation:', error);
    process.exit(1);
  }
}
