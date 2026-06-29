import { action } from './run.js';
import { startStdioServer } from '../../mcp/index.js';
import type { McpServerOptions } from '../../mcp/options.js';

/**
 * `banira mcp` — run banira as a Model Context Protocol server over stdio. The
 * `action` wrapper handles a startup failure (stderr + non-zero exit); once the
 * transport is connected the process stays alive on the stdin read loop.
 */
export const mcp = action('Failed to start MCP server', async (options: McpServerOptions = {}) => {
  await startStdioServer(options);
});
