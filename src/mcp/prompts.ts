import type { Registries } from './registry.js';
import type { McpServerOptions } from './options.js';

/**
 * MCP prompts — guided workflows the client can surface to the user. They emit a
 * single user message that walks the agent through a banira tool chain; the
 * `document_and_verify` chain is the composability that makes MCP outperform
 * RAG. Under `--read-only`, `document_and_verify` registers a verify-only variant
 * (no scaffolding/docs writes implied).
 */

function userText(text: string) {
  return { role: 'user' as const, content: { type: 'text' as const, text } };
}

function documentAndVerifyText(file: string, tagName: string, readOnly: boolean): string {
  const chain = readOnly
    ? `1. check_component { files: ["${file}"] } — fix any diagnostics it reports.\n` +
      `2. test_component { file: "${file}", tagName: "${tagName}" } — confirm it registers and upgrades.`
    : `1. scaffold_component { tagName: "${tagName}" } — only if the component does not exist yet.\n` +
      `2. check_component { files: ["${file}"] } — fix any diagnostics, then re-run until clean.\n` +
      `3. test_component { file: "${file}", tagName: "${tagName}" } — confirm it registers and upgrades.\n` +
      `4. generate_docs { file: "${file}" } — produce the HTML documentation page.`;
  return (
    `Document and verify the component <${tagName}> in ${file} by running this tool chain in order:\n\n` +
    `${chain}\n\n` +
    `Report the diagnostics, the mount result${readOnly ? '' : ', and the generated docs'}.`
  );
}

/** Register the three guided-workflow prompts. */
export function registerPrompts(registries: Registries, opts: McpServerOptions): void {
  registries.definePrompt({
    def: {
      name: 'implement_component_with_attributes',
      title: 'Implement component with attributes',
      description: 'Scaffold a component and add a given set of attributes, banira-shaped.',
      arguments: [
        { name: 'tagName', description: 'Custom element tag name (must contain a hyphen).', required: true },
        { name: 'attributes', description: 'Comma-separated attribute names (optionally name:type).', required: true },
      ],
    },
    render: (args) => ({
      description: `Implement ${args.tagName} with attributes: ${args.attributes}`,
      messages: [
        userText(
          `Implement a vanilla web component <${args.tagName}> with these attributes: ${args.attributes}.\n\n` +
            `Steps:\n` +
            `1. Call get_authoring_guidelines to confirm banira's conventions (the observedAttributes pattern and the JSDoc tags the manifest reads).\n` +
            `2. Call scaffold_component { tagName: "${args.tagName}" } to get a banira-shaped starter.\n` +
            `3. For each attribute, add it to static get observedAttributes(), add a matching getter/setter, and handle it in attributeChangedCallback. Use a string-literal-union setter type for enum attributes so the manifest records the allowed values.\n` +
            `4. Call check_component to type-check, then get_component_api to confirm every attribute is detected.`
        ),
      ],
    }),
  });

  registries.definePrompt({
    def: {
      name: 'add_event_to_component',
      title: 'Add an event to a component',
      description: 'Add and wire a CustomEvent, updating the JSDoc so the manifest detects it.',
      arguments: [
        { name: 'file', description: 'The component .ts file.', required: true },
        { name: 'eventName', description: 'The event name to dispatch.', required: true },
        { name: 'detailType', description: 'TypeScript type of the event detail payload.', required: false },
      ],
    },
    render: (args) => {
      const firesType = args.detailType ? `{${args.detailType}} ` : '';
      const detail = args.detailType ? `{ /* ${args.detailType} */ }` : '{ /* payload */ }';
      return {
        messages: [
          userText(
            `Add a custom event "${args.eventName}" to the component in ${args.file}.\n\n` +
              `Steps:\n` +
              `1. Dispatch it where appropriate: this.dispatchEvent(new CustomEvent('${args.eventName}', { detail: ${detail} })).\n` +
              `2. Add a class-level JSDoc tag so ManifestGenerator records it: @fires ${firesType}${args.eventName} - <description>.\n` +
              `3. Call check_component to type-check, then get_component_api { file: "${args.file}" } to confirm the event (and its detail type) is detected.`
          ),
        ],
      };
    },
  });

  registries.definePrompt({
    def: {
      name: 'document_and_verify',
      title: 'Document and verify a component',
      description: 'The composable end-to-end flow: verify a component and (unless read-only) document it.',
      arguments: [
        { name: 'file', description: 'The component .ts file.', required: true },
        { name: 'tagName', description: 'The component tag name.', required: true },
      ],
    },
    render: (args) => ({
      messages: [userText(documentAndVerifyText(args.file ?? '', args.tagName ?? '', opts.readOnly === true))],
    }),
  });
}
