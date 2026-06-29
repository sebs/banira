/**
 * In-memory registries of the tools, resources, and prompts a server instance
 * exposes. Tool modules populate these in later milestones; the dispatcher
 * (`index.ts`) reads them to answer the list/call/read/get methods.
 */

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDef {
  name: string;
  title?: string;
  description: string;
  /** JSON Schema (common draft-07 ∩ 2020-12 subset) for the call arguments. */
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
}

/** A tool result body — the MCP `CallToolResult` shape. */
export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * A tool handler returns the structured result data; the dispatcher wraps it
 * into a {@link ToolCallResult} (a `text` mirror plus `structuredContent`). To
 * signal a business failure, a handler throws — the dispatcher converts that to
 * a result with `isError: true`.
 */
export type ToolHandler = (args: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;

export interface RegisteredTool {
  def: ToolDef;
  handler: ToolHandler;
}

export interface ResourceDef {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text: string;
}

export type ResourceReader = (uri: string) => ResourceContent[] | Promise<ResourceContent[]>;

export interface RegisteredResource {
  def: ResourceDef;
  read: ResourceReader;
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface PromptDef {
  name: string;
  title?: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

export interface PromptResult {
  description?: string;
  messages: PromptMessage[];
}

export type PromptRenderer = (args: Record<string, string>) => PromptResult | Promise<PromptResult>;

export interface RegisteredPrompt {
  def: PromptDef;
  render: PromptRenderer;
}

/** The set of tools, resources, and prompts a server instance exposes. */
export interface Registries {
  defineTool(def: ToolDef, handler: ToolHandler): void;
  getTool(name: string): RegisteredTool | undefined;
  toolDefs(): ToolDef[];
  defineResource(resource: RegisteredResource): void;
  getResource(uri: string): RegisteredResource | undefined;
  resourceDefs(): ResourceDef[];
  definePrompt(prompt: RegisteredPrompt): void;
  getPrompt(name: string): RegisteredPrompt | undefined;
  promptDefs(): PromptDef[];
}

/**
 * Create empty tool/resource/prompt registries. The caller populates them via
 * the tool modules (e.g. `registerIntrospectionTools`), gating which tools are
 * registered on the server options.
 */
export function createRegistries(): Registries {
  const tools = new Map<string, RegisteredTool>();
  const resources = new Map<string, RegisteredResource>();
  const prompts = new Map<string, RegisteredPrompt>();

  return {
    defineTool: (def, handler) => {
      tools.set(def.name, { def, handler });
    },
    getTool: (name) => tools.get(name),
    toolDefs: () => [...tools.values()].map((t) => t.def),
    defineResource: (resource) => {
      resources.set(resource.def.uri, resource);
    },
    getResource: (uri) => resources.get(uri),
    resourceDefs: () => [...resources.values()].map((r) => r.def),
    definePrompt: (prompt) => {
      prompts.set(prompt.def.name, prompt);
    },
    getPrompt: (name) => prompts.get(name),
    promptDefs: () => [...prompts.values()].map((p) => p.def),
  };
}
