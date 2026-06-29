import { resolve, dirname, basename, extname, sep } from 'node:path';
import { readFileSync } from 'node:fs';
import { DocGen, type DocGenOptions, type Stylesheet } from '../../index.js';
import type { Registries } from '../registry.js';
import type { McpServerOptions } from '../options.js';
import { resolveInputFiles } from '../files.js';

/**
 * Group 3 — docs generation. `generate_docs` returns a standalone HTML doc page
 * (summary, @demo, full API reference) as a string — it is read-only and never
 * writes a file (the caller persists the HTML). Under `--local-only` the page is
 * forced to a local/inline stylesheet instead of the default CDN, and a remote
 * `scriptSrc` is refused.
 */

const isRemote = (url: string): boolean => /^https?:\/\//i.test(url);

interface ResolvedStylesheet {
  stylesheet?: Stylesheet;
  stylesheetMode: 'href' | 'inline' | 'none';
  usedNetworkDefault: boolean;
}

/** Resolve the page stylesheet, honoring `--local-only` (never emit a network reference). */
function resolveStylesheet(args: Record<string, unknown>, opts: McpServerOptions): ResolvedStylesheet {
  const localOnly = opts.localOnly === true;
  const root = resolve(opts.project ? dirname(opts.project) : process.cwd());
  const readConfined = (p: string): string => {
    const r = resolve(p);
    if (localOnly && r !== root && !r.startsWith(root + sep)) {
      throw new Error(`--local-only: refusing to read ${r} (outside ${root})`);
    }
    return readFileSync(r, 'utf8');
  };

  const stylesheetPath = typeof args.stylesheetPath === 'string' ? args.stylesheetPath : undefined;
  if (stylesheetPath) {
    return { stylesheet: { inline: readConfined(stylesheetPath) }, stylesheetMode: 'inline', usedNetworkDefault: false };
  }

  const input = args.stylesheet;
  if (input === 'none') return { stylesheet: 'none', stylesheetMode: 'none', usedNetworkDefault: false };
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (typeof o.inline === 'string') {
      return { stylesheet: { inline: o.inline }, stylesheetMode: 'inline', usedNetworkDefault: false };
    }
    if (typeof o.href === 'string') {
      if (localOnly) {
        if (isRemote(o.href)) return { stylesheet: 'none', stylesheetMode: 'none', usedNetworkDefault: true };
        return { stylesheet: { inline: readConfined(o.href) }, stylesheetMode: 'inline', usedNetworkDefault: false };
      }
      return { stylesheet: { href: o.href }, stylesheetMode: 'href', usedNetworkDefault: false };
    }
  }

  // No stylesheet given → DocGen would default to the PicoCSS CDN href.
  if (localOnly) return { stylesheet: 'none', stylesheetMode: 'none', usedNetworkDefault: true };
  return { stylesheetMode: 'href', usedNetworkDefault: true };
}

/** Register `generate_docs` (read-only, always available). */
export function registerDocsTools(registries: Registries, opts: McpServerOptions): void {
  registries.defineTool(
    {
      name: 'generate_docs',
      title: 'Generate component docs (HTML)',
      description:
        'Produce a standalone HTML documentation page (summary, @demo, and a full API reference) for a component, returned as a string. Read-only: it returns the HTML, it does not write a file. Under --local-only the page uses a local/inline stylesheet instead of the default CDN.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'The component .ts file to document.' },
          tagName: { type: 'string', description: 'The component tag name (default: the file basename).' },
          scriptSrc: { type: 'string', description: 'Component module src in the page (default ./dist/<tag>.js).' },
          stylesheet: {
            description: 'Page stylesheet: {href}, {inline} CSS, or "none". Default: PicoCSS CDN.',
            oneOf: [
              { type: 'object', properties: { href: { type: 'string' } }, required: ['href'], additionalProperties: false },
              { type: 'object', properties: { inline: { type: 'string' } }, required: ['inline'], additionalProperties: false },
              { const: 'none' },
            ],
          },
          stylesheetPath: { type: 'string', description: 'A local .css file to read and inline.' },
        },
        required: ['file'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          html: { type: 'string' },
          tagName: { type: 'string' },
          scriptSrc: { type: 'string' },
          stylesheetMode: { enum: ['href', 'inline', 'none'] },
          usedNetworkDefault: { type: 'boolean' },
        },
        required: ['html', 'tagName', 'stylesheetMode', 'usedNetworkDefault'],
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      const file = resolveInputFiles({ files: [String(args.file)] }, opts)[0]!;
      const tagName = typeof args.tagName === 'string' ? args.tagName : basename(file, extname(file));
      const scriptSrc = typeof args.scriptSrc === 'string' ? args.scriptSrc : undefined;
      if (scriptSrc && opts.localOnly && isRemote(scriptSrc)) {
        throw new Error('--local-only: refusing a remote scriptSrc (use a local/relative path).');
      }

      const { stylesheet, stylesheetMode, usedNetworkDefault } = resolveStylesheet(args, opts);

      const docOptions: DocGenOptions = {};
      if (scriptSrc !== undefined) docOptions.scriptSrc = scriptSrc;
      if (stylesheet !== undefined) docOptions.stylesheet = stylesheet;

      const html = await new DocGen(tagName, docOptions).generate(file);

      const result: Record<string, unknown> = { html, tagName, stylesheetMode, usedNetworkDefault };
      if (scriptSrc !== undefined) result.scriptSrc = scriptSrc;
      return result;
    }
  );
}
