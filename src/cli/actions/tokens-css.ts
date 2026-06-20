import { parseDesignTokens, designTokensToCss } from '../../index.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { action, emit, plural } from './run.js';

/**
 * `banira tokens-css <tokens.json>` — compile a W3C Design Tokens (DTCG)
 * document into a `:root` CSS custom-property stylesheet, resolving `{alias}`
 * references. Writes to stdout unless `-o` is given.
 */
export const tokensCss = action(
  'Failed to import design tokens',
  async (file: string, options: { output?: string; selector?: string } = {}) => {
    const doc = JSON.parse(readFileSync(resolve(file), 'utf8'));
    const tokens = parseDesignTokens(doc);
    const css = designTokensToCss(tokens, options.selector ? { selector: options.selector } : {});
    const outPath = await emit(css, options.output);
    if (outPath) {
      console.log(`Wrote ${plural(tokens.length, 'token')} to ${outPath}`);
    }
  }
);
