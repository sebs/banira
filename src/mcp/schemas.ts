/**
 * Shared JSON Schema fragments reused across tool input/output schemas. Kept to
 * the common draft-07 ∩ 2020-12 subset (no `$schema`, no dialect-specific
 * keywords) so the same schema validates under ajv and the dialect MCP clients
 * assume.
 */

/** The serializable diagnostic shape produced by `toDiagItem` (see diagnostics.ts). */
export const DIAG_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    category: { enum: ['error', 'warning', 'message'] },
    message: { type: 'string' },
    file: { type: ['string', 'null'] },
    line: { type: ['number', 'null'] },
    column: { type: ['number', 'null'] },
  },
  required: ['code', 'category', 'message'],
  additionalProperties: false,
};
