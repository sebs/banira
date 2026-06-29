import {
  eventTypeText,
  manifestToMarkdown,
  DocGen,
  type Package,
  type CustomElementDeclaration,
  type ClassField,
  type ClassMethod,
} from '../../index.js';
import { type DocNode, type DocFencedCode } from '@microsoft/tsdoc';
import type { Registries } from '../registry.js';
import type { McpServerOptions } from '../options.js';
import { resolveInputFiles, manifestFor, InputError } from '../files.js';

/**
 * Group 1 — component introspection. Three read-only tools backed by
 * `ManifestGenerator` so an agent never has to guess a component's API. All are
 * registered in every mode (including `--read-only`).
 */

const filesOrDir = {
  files: { type: 'array', items: { type: 'string' }, description: 'Component .ts files (absolute or cwd-relative).' },
  dir: { type: 'string', description: 'A directory to scan for .ts components.' },
} as const;

function selectDeclaration(
  pkg: Package,
  tagName?: string,
  className?: string
): CustomElementDeclaration | undefined {
  const all = pkg.modules.flatMap((m) => m.declarations);
  if (tagName) return all.find((d) => d.tagName === tagName);
  if (className) return all.find((d) => d.name === className);
  return all[0];
}

/** Project a declaration into the compact, agent-friendly API view. */
function projectApi(d: CustomElementDeclaration): Record<string, unknown> {
  const members = d.members ?? [];
  return {
    tagName: d.tagName ?? null,
    className: d.name,
    summary: d.summary,
    description: d.description,
    role: d.role,
    deprecated: d.deprecated,
    superclass: d.superclass?.name,
    attributes: (d.attributes ?? []).map((a) => ({
      name: a.name,
      type: a.type?.text,
      default: a.default,
      values: a.values,
      description: a.description,
      deprecated: a.deprecated,
      fieldName: a.fieldName,
    })),
    properties: members
      .filter((m): m is ClassField => m.kind === 'field')
      .map((f) => ({
        name: f.name,
        type: f.type?.text,
        default: f.default,
        readonly: f.readonly,
        static: f.static,
        privacy: f.privacy,
        description: f.description,
        deprecated: f.deprecated,
      })),
    methods: members
      .filter((m): m is ClassMethod => m.kind === 'method')
      .map((m) => ({
        name: m.name,
        parameters: (m.parameters ?? []).map((p) => ({
          name: p.name,
          type: p.type?.text,
          optional: p.optional,
          default: p.default,
          rest: p.rest,
        })),
        returnType: m.return?.type?.text,
        privacy: m.privacy,
        static: m.static,
        description: m.description,
        deprecated: m.deprecated,
      })),
    events: (d.events ?? []).map((e) => ({
      name: e.name,
      type: eventTypeText(e),
      detailType: e.detailType?.text,
      description: e.description,
      deprecated: e.deprecated,
    })),
    slots: (d.slots ?? []).map((s) => ({ name: s.name || '(default)', description: s.description })),
    cssParts: (d.cssParts ?? []).map((s) => ({ name: s.name, description: s.description })),
    cssProperties: (d.cssProperties ?? []).map((c) => ({ name: c.name, default: c.default, description: c.description })),
  };
}

/** Register `get_component_manifest`, `get_component_api`, and `list_components`. */
export function registerIntrospectionTools(registries: Registries, opts: McpServerOptions): void {
  registries.defineTool(
    {
      name: 'get_component_manifest',
      title: 'Get component manifest',
      description:
        'Return the full Custom Elements Manifest (custom-elements.json, schemaVersion 2.1.0) for the given component file(s). The flagship typed-data tool — use it to avoid hallucinating attributes, properties, events, slots, CSS parts, or CSS custom properties.',
      inputSchema: {
        type: 'object',
        properties: { ...filesOrDir, markdown: { type: 'boolean', description: 'Also include a Markdown API rendering.' } },
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          schemaVersion: { type: 'string' },
          modules: { type: 'array' },
          markdown: { type: 'string' },
        },
        required: ['schemaVersion', 'modules'],
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) => {
      const pkg = manifestFor(resolveInputFiles(args, opts));
      const base: Record<string, unknown> = { schemaVersion: pkg.schemaVersion, modules: pkg.modules };
      if (args.markdown === true) base.markdown = manifestToMarkdown(pkg);
      return base;
    }
  );

  registries.defineTool(
    {
      name: 'get_component_api',
      title: 'Get component API',
      description:
        'For one component, return a compact typed view: tag name, class name, attributes, properties, methods, events, slots, CSS parts, and CSS custom properties. Select by tagName or className; defaults to the first component found.',
      inputSchema: {
        type: 'object',
        properties: {
          ...filesOrDir,
          tagName: { type: 'string', description: 'Select the component by its custom-element tag name.' },
          className: { type: 'string', description: 'Select the component by its class name.' },
          format: { enum: ['json', 'markdown'], description: 'Output format (default json).' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) => {
      const pkg = manifestFor(resolveInputFiles(args, opts));
      const tagName = typeof args.tagName === 'string' ? args.tagName : undefined;
      const className = typeof args.className === 'string' ? args.className : undefined;
      const d = selectDeclaration(pkg, tagName, className);
      if (!d) {
        const which = tagName ?? className;
        throw new InputError(
          which ? `No component matching "${which}" was found in the given files.` : 'No components were found in the given files.'
        );
      }
      if (args.format === 'markdown') {
        const single: Package = {
          schemaVersion: '2.1.0',
          modules: [{ kind: 'javascript-module', path: '', declarations: [d], exports: [] }],
        };
        return { tagName: d.tagName ?? null, className: d.name, markdown: manifestToMarkdown(single) };
      }
      return projectApi(d);
    }
  );

  registries.defineTool(
    {
      name: 'list_components',
      title: 'List components',
      description:
        'Scan the given file(s)/directory and list every custom element with its tag name, class name, one-line summary, and per-feature counts.',
      inputSchema: {
        type: 'object',
        properties: { ...filesOrDir },
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: { components: { type: 'array' } },
        required: ['components'],
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) => {
      const pkg = manifestFor(resolveInputFiles(args, opts));
      const components = pkg.modules.flatMap((m) =>
        m.declarations.map((d) => ({
          tagName: d.tagName ?? null,
          className: d.name,
          modulePath: m.path,
          summary: d.summary,
          description: d.description,
          deprecated: d.deprecated,
          counts: {
            attributes: (d.attributes ?? []).length,
            properties: (d.members ?? []).filter((x) => x.kind === 'field').length,
            methods: (d.members ?? []).filter((x) => x.kind === 'method').length,
            events: (d.events ?? []).length,
            slots: (d.slots ?? []).length,
            cssParts: (d.cssParts ?? []).length,
            cssProperties: (d.cssProperties ?? []).length,
          },
        }))
      );
      return { components };
    }
  );

  registries.defineTool(
    {
      name: 'get_component_demo',
      title: 'Get component demo',
      description:
        "Extract a component's @demo blocks as structured { language, code } usage examples (plus the TSDoc summary), so the agent shows real usage instead of inventing it. Backed by the TSDoc parser, not the manifest (banira does not emit demos into the CEM).",
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'The component .ts file.' },
          tagName: { type: 'string', description: 'The component tag name (used to pick its manifest summary).' },
        },
        required: ['file', 'tagName'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          tagName: { type: 'string' },
          summary: { type: 'string' },
          demos: {
            type: 'array',
            items: {
              type: 'object',
              properties: { language: { type: 'string' }, code: { type: 'string' } },
              required: ['language', 'code'],
              additionalProperties: false,
            },
          },
        },
        required: ['tagName', 'demos'],
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      // `file`/`tagName` are required strings in the input schema, validated by
      // ajv before this handler runs — use them as-is rather than String()-coercing
      // (which would silently turn a schema/code mismatch into "[object Object]").
      const file = resolveInputFiles({ files: [args.file as string] }, opts)[0]!;
      const tagName = args.tagName as string;
      const dg = new DocGen(tagName);
      const ctx = await dg.parseDoc(file);
      // No doc comment is not an error — just no demos.
      if (!ctx.docComment) return { tagName, demos: [] };
      // collectFencedCode is private to FormatterDocPage; re-walk the TSDoc tree here.
      const walk = (n: DocNode): DocFencedCode[] =>
        n.kind === 'FencedCode' ? [n as DocFencedCode] : n.getChildNodes().flatMap(walk);
      const demos = ctx.docComment.customBlocks
        .filter((b) => b.blockTag.tagName === '@demo')
        .flatMap((b) => walk(b.content).map((fc) => ({ language: fc.language, code: fc.code })));
      const summary = dg.manifestDeclaration(file)?.summary;
      return summary !== undefined ? { tagName, demos, summary } : { tagName, demos };
    }
  );
}
