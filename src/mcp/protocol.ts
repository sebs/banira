import { createInterface } from 'node:readline';

/**
 * The MCP base protocol: newline-delimited JSON-RPC 2.0 over stdio. This module
 * owns the wire format — envelopes, error codes, version negotiation, and the
 * transport loop — so the rest of `src/mcp/` only deals in parsed messages.
 */

/** JSON-RPC 2.0 message id. MCP forbids a null id on requests. */
export type JsonRpcId = string | number;

/** A parsed inbound JSON-RPC request or notification (a notification omits `id`). */
export interface IncomingMessage {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: JsonRpcId | null;
  result: Record<string, unknown>;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: JsonRpcId | null;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

// Standard JSON-RPC 2.0 error codes, plus the one MCP base code we emit.
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
export const RESOURCE_NOT_FOUND = -32002;

/** Build a JSON-RPC success envelope. */
export const ok = (id: JsonRpcId | null, result: Record<string, unknown>): JsonRpcSuccess => ({
  jsonrpc: '2.0',
  id,
  result,
});

/** Build a JSON-RPC error envelope (omitting `data` when not supplied). */
export const err = (id: JsonRpcId | null, code: number, message: string, data?: unknown): JsonRpcError =>
  data === undefined
    ? { jsonrpc: '2.0', id, error: { code, message } }
    : { jsonrpc: '2.0', id, error: { code, message, data } };

// --- Protocol version negotiation -----------------------------------------

/** Latest MCP revision banira targets. */
export const LATEST_PROTOCOL_VERSION = '2025-11-25';

/** Revisions banira will echo back when a client requests one of them. */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

/**
 * Echo the client's requested protocol version when banira supports it,
 * otherwise return banira's latest. banira never errors on an unknown version —
 * it lets the client decide whether to proceed or disconnect.
 */
export function negotiateVersion(requested: unknown): string {
  return typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

// --- Transport (newline-delimited JSON-RPC over stdio) ---------------------

/** The outcome of decoding one line of stdin. */
export type DecodeResult =
  | { kind: 'empty' }
  | { kind: 'message'; message: IncomingMessage }
  | { kind: 'error'; response: JsonRpcResponse };

/**
 * Parse and shape-check a single newline-delimited frame. Pure (no I/O) so the
 * transport contract is unit-testable without a real stdin. A blank line is
 * ignored; a malformed or non-conforming frame yields a JSON-RPC error envelope
 * with a null id, since the id may itself be unreadable.
 */
export function decode(line: string): DecodeResult {
  const text = line.trim();
  if (!text) return { kind: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'error', response: err(null, PARSE_ERROR, 'Parse error') };
  }

  // Batching was removed in MCP 2025-06-18; banira rejects arrays outright.
  if (Array.isArray(parsed)) {
    return { kind: 'error', response: err(null, INVALID_REQUEST, 'Batch requests are not supported') };
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { kind: 'error', response: err(null, INVALID_REQUEST, 'Invalid Request') };
  }

  const m = parsed as Record<string, unknown>;
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
    return { kind: 'error', response: err(null, INVALID_REQUEST, 'Invalid Request') };
  }
  // A request id, when present, MUST be a string or number — never null.
  if ('id' in m && m.id !== undefined && typeof m.id !== 'string' && typeof m.id !== 'number') {
    return { kind: 'error', response: err(null, INVALID_REQUEST, 'Invalid Request') };
  }

  return { kind: 'message', message: m as unknown as IncomingMessage };
}

/**
 * Drive the stdio transport: read newline-delimited JSON-RPC from stdin, route
 * each message through `handle`, and write each response back as compact
 * single-line JSON. `process.stdout` is the only sink, and `JSON.stringify`
 * escapes embedded newlines, so a frame can never contain a raw `\n`.
 */
export function serveStdio(handle: (message: IncomingMessage) => Promise<JsonRpcResponse | null>): void {
  const write = (response: JsonRpcResponse): void => {
    process.stdout.write(JSON.stringify(response) + '\n');
  };
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const decoded = decode(line);
    if (decoded.kind === 'empty') return;
    if (decoded.kind === 'error') {
      write(decoded.response);
      return;
    }
    void handle(decoded.message).then((response) => {
      if (response) write(response);
    });
  });
}
