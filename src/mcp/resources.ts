import { resolve, dirname } from 'node:path';
import { ManifestGenerator, findModuleFiles } from '../index.js';
import type { Registries } from './registry.js';
import type { McpServerOptions } from './options.js';
import { authoringGuideMarkdown } from './tools/authoring.js';

/**
 * MCP resources — application-driven, browsable documents: the authoring guide
 * (the source-derived conventions as Markdown) and a workspace-components
 * manifest (the Custom Elements Manifest for every component under the project
 * root). Both are read-only.
 */
export function registerResources(registries: Registries, opts: McpServerOptions): void {
  registries.defineResource({
    def: {
      uri: 'resource://banira/authoring-guide',
      name: 'banira authoring guide',
      title: 'banira authoring guide',
      description: 'banira component-authoring conventions (JSDoc tag contract, naming, philosophy, starter components).',
      mimeType: 'text/markdown',
    },
    read: (uri) => [{ uri, mimeType: 'text/markdown', text: authoringGuideMarkdown() }],
  });

  registries.defineResource({
    def: {
      uri: 'resource://banira/components',
      name: 'banira workspace components',
      title: 'Workspace components',
      description: 'Custom Elements Manifest for every component under the project root (or --project dir).',
      mimeType: 'application/json',
    },
    read: (uri) => {
      const root = resolve(opts.project ? dirname(opts.project) : process.cwd());
      // findModuleFiles skips node_modules + dot-dirs; drop .d.ts declaration files.
      const files = findModuleFiles(root, ['.ts']).filter((f) => !f.endsWith('.d.ts'));
      const pkg = new ManifestGenerator(files).generate();
      return [{ uri, mimeType: 'application/json', text: JSON.stringify(pkg, null, 2) }];
    },
  });
}
