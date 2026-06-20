import { ManifestGenerator, collectDesignTokens, designTokensToMarkdown } from '../../index.js';
import { resolve } from 'path';
import { action, emit, plural } from './run.js';

/**
 * `banira tokens <files...>` — emit a dedicated theming / design-tokens document
 * (Markdown) from the components' CSS custom properties, grouped per component
 * and by token namespace. Complements `manifest --md`'s inline per-component table.
 */
export const tokens = action(
  'Failed to generate design tokens',
  async (files: string[], options: { output?: string; title?: string } = {}) => {
    const pkg = new ManifestGenerator(files.map((f) => resolve(f))).generate();
    const output = designTokensToMarkdown(pkg, options.title ? { title: options.title } : {});
    const outPath = await emit(output, options.output);
    if (outPath) {
      const count = collectDesignTokens(pkg).length;
      console.log(`Design tokens written to ${outPath} (${plural(count, 'component')})`);
    }
  }
);
