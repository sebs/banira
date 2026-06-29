/**
 * Configuration for the banira MCP server, threaded from the `banira mcp` CLI
 * flags through to tool registration and the file-access guards.
 */
export interface McpServerOptions {
  /** Expose only read/analysis tools; no file writes or scaffolding. */
  readOnly?: boolean;
  /** Restrict file access to the project/cwd and disable network-reaching output. */
  localOnly?: boolean;
  /** Path to a tsconfig.json whose options override the compiler defaults. */
  project?: string;
}
