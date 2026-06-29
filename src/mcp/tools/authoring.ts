import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, sep } from 'node:path';
import { scaffoldComponent, type ScaffoldOptions } from '../../index.js';
import type { Registries } from '../registry.js';
import type { McpServerOptions } from '../options.js';
import { invalidateManifest } from '../files.js';

/**
 * Group 4 — authoring guidance. `get_authoring_guidelines` returns banira's
 * conventions (the JSDoc tag contract `ManifestGenerator` reads + per-variant
 * starter components), so a generic agent writes *banira-shaped* components.
 * `scaffold_component` generates that starter from a spec. The guidance is
 * derived from the actual `scaffoldComponent` output and the manifest tag
 * contract — not invented prose.
 */

const VARIANTS = ['plain', 'form-associated', 'aria', 'hydrate'] as const;
type Variant = (typeof VARIANTS)[number];

/** The class-level JSDoc tags `ManifestGenerator` reads (src/manifest.ts). */
const TAGS = [
  { tag: '@summary', level: 'class', syntax: '@summary <one-line summary>', semantics: 'One-line description; becomes the declaration `summary`.' },
  { tag: '@slot', level: 'class', syntax: "@slot name - description  ('@slot - description' for the default slot)", semantics: 'Declares a <slot>; surfaces in manifest `slots`.' },
  { tag: '@csspart', level: 'class', syntax: '@csspart name - description', semantics: 'Declares a ::part() styling hook; manifest `cssParts`.' },
  { tag: '@cssprop', level: 'class', syntax: '@cssprop [--name=default] - description  (alias @cssproperty)', semantics: 'Declares a CSS custom property; manifest `cssProperties`.' },
  { tag: '@fires', level: 'class', syntax: '@fires {DetailType} name - description  (alias @event)', semantics: 'Declares a CustomEvent and its detail type; manifest `events`.' },
  { tag: '@role', level: 'class', syntax: '@role <aria-role>', semantics: "Records the element's implicit ARIA role (set via ElementInternals.role)." },
  { tag: '@deprecated', level: 'class or member', syntax: '@deprecated [reason]', semantics: 'Marks the class/member deprecated; the text is the note.' },
  { tag: '@demo', level: 'class (TSDoc)', syntax: '@demo then a fenced ```html code block', semantics: 'A runnable usage example, rendered live and as source by the doc generator.' },
  { tag: '@internal / @ignore', level: 'class', syntax: '@internal', semantics: 'Excludes the class from the manifest.' },
];

const NAMING_RULE =
  'Tag names must be lowercase, start with a letter, and contain a hyphen (e.g. my-button). Pattern: /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/';

const ATTRIBUTE_PATTERN =
  'Attributes come from `static get observedAttributes()` plus matching get/set accessors. A string-literal-union setter type (e.g. \'sm\' | \'md\' | \'lg\') is surfaced as the attribute\'s allowed `values`.';

const PHILOSOPHY = [
  'No bundler, no framework: author standard ES modules that run in the browser as-is.',
  'Use modern CSS (nesting, custom properties, ::part) and the platform (shadow DOM, ElementInternals, Declarative Shadow DOM).',
  'Author in TypeScript; banira compiles to browser-ready JS and derives the Custom Elements Manifest from your source + JSDoc.',
  'Annotate with the JSDoc tags above so the manifest — and every artifact derived from it — stays accurate.',
];

function variantOptions(variant: Variant): ScaffoldOptions {
  switch (variant) {
    case 'form-associated':
      return { formAssociated: true };
    case 'aria':
      return { aria: true };
    case 'hydrate':
      return { hydrate: true };
    default:
      return {};
  }
}

const camelKey: Record<Variant, string> = {
  plain: 'plain',
  'form-associated': 'formAssociated',
  aria: 'aria',
  hydrate: 'hydrate',
};

/** The starter component source for a variant (the generated `.ts` file). */
function exampleSource(variant: Variant): string {
  const files = scaffoldComponent('my-element', variantOptions(variant));
  return files.find((f) => f.path.endsWith('.ts'))?.content ?? '';
}

/** The structured guidance object returned by `get_authoring_guidelines`. */
export function authoringGuidelines(variant?: string): Record<string, unknown> {
  const chosen = variant && (VARIANTS as readonly string[]).includes(variant) ? [variant as Variant] : [...VARIANTS];
  const examples: Record<string, string> = {};
  for (const v of chosen) examples[camelKey[v]] = exampleSource(v);
  return { tags: TAGS, namingRule: NAMING_RULE, attributePattern: ATTRIBUTE_PATTERN, philosophy: PHILOSOPHY, examples };
}

/** The same guidance rendered as a Markdown document (for the authoring-guide resource). */
export function authoringGuideMarkdown(): string {
  const lines: string[] = [
    '# banira authoring guidelines',
    '',
    '## Naming',
    '',
    NAMING_RULE,
    '',
    '## Attributes & properties',
    '',
    ATTRIBUTE_PATTERN,
    '',
    '## Philosophy',
    '',
    ...PHILOSOPHY.map((p) => `- ${p}`),
    '',
    '## JSDoc tags the manifest reads',
    '',
    '| Tag | Level | Syntax | Meaning |',
    '| --- | --- | --- | --- |',
    ...TAGS.map((t) => `| \`${t.tag}\` | ${t.level} | ${t.syntax} | ${t.semantics} |`),
    '',
    '## Starter components',
    '',
  ];
  for (const v of VARIANTS) {
    lines.push(`### ${v}`, '', '```ts', exampleSource(v).trimEnd(), '```', '');
  }
  return lines.join('\n');
}

/** Register `get_authoring_guidelines` (always) and `scaffold_component` (unless read-only). */
export function registerAuthoringTools(registries: Registries, opts: McpServerOptions): void {
  registries.defineTool(
    {
      name: 'get_authoring_guidelines',
      title: 'Get authoring guidelines',
      description:
        "Return banira's conventions: the JSDoc tags the manifest reads (@summary/@slot/@csspart/@cssprop/@fires/@role/@deprecated/@demo), the observedAttributes pattern, the tag-naming rule, the no-bundler/web-standards philosophy, and per-variant starter components. Use this so generated components are banira-shaped.",
      inputSchema: {
        type: 'object',
        properties: {
          variant: { enum: [...VARIANTS], description: 'Limit the worked example to one variant (default: all four).' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) => authoringGuidelines(typeof args.variant === 'string' ? args.variant : undefined)
  );

  // scaffold_component writes nothing by default, but with write:true it mutates
  // the filesystem — omit it entirely in read-only mode.
  if (opts.readOnly) return;

  registries.defineTool(
    {
      name: 'scaffold_component',
      title: 'Scaffold a component',
      description:
        'Generate a starter vanilla web component (and a demo index.html), pre-annotated with the JSDoc tags ManifestGenerator reads. Returns the files in memory; pass write:true to write them to disk (dir defaults to ".", will not overwrite without force:true).',
      inputSchema: {
        type: 'object',
        properties: {
          tagName: { type: 'string', description: 'Custom element tag name (lowercase, must contain a hyphen).' },
          variant: { enum: [...VARIANTS], description: 'plain (default), form-associated, aria, or hydrate.' },
          write: { type: 'boolean', description: 'Write the files to disk (default false — returns them in memory).' },
          dir: { type: 'string', description: 'Target directory when writing (default ".").' },
          force: { type: 'boolean', description: 'Overwrite existing files when writing.' },
        },
        required: ['tagName'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) => {
      const tagName = String(args.tagName);
      const variant = (typeof args.variant === 'string' ? args.variant : 'plain') as Variant;
      // scaffoldComponent throws on an invalid tag name → the dispatcher reports isError.
      const files = scaffoldComponent(tagName, variantOptions(variant));
      const result: Record<string, unknown> = {
        variant,
        files: files.map((f) => ({ path: f.path, content: f.content })),
      };

      if (args.write === true) {
        const targetDir = resolve(typeof args.dir === 'string' ? args.dir : '.');
        if (opts.localOnly) {
          const root = resolve(opts.project ? dirname(opts.project) : process.cwd());
          if (targetDir !== root && !targetDir.startsWith(root + sep)) {
            throw new Error(`--local-only: refusing to write outside ${root}`);
          }
        }
        const written: string[] = [];
        for (const f of files) {
          const outPath = join(targetDir, f.path);
          if (!args.force && existsSync(outPath)) {
            throw new Error(`Refusing to overwrite ${outPath} (pass force:true to allow).`);
          }
          mkdirSync(dirname(outPath), { recursive: true });
          writeFileSync(outPath, f.content, 'utf8');
          written.push(outPath);
        }
        invalidateManifest(written.filter((p) => p.endsWith('.ts')));
        result.written = written;
      }

      return result;
    }
  );
}
