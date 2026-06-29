// Named import (rather than the default) because ajv ships as CommonJS: under
// NodeNext the default import resolves to the module namespace, which TypeScript
// rejects as non-constructable. `module.exports.Ajv` makes the named form work
// at runtime too.
import { Ajv, type ValidateFunction } from 'ajv';

/**
 * Server-side validation of tool-call arguments against a tool's JSON Schema.
 * banira ships `ajv` as a runtime dependency, so this rigorous check is always
 * available — handlers still apply the cross-field semantic rules (e.g. "at
 * least one of files/dir") that a JSON Schema cannot express.
 */

export interface ValidationResult {
  valid: boolean;
  /** One human-readable message per schema violation; empty when valid. */
  errors: string[];
}

// One Ajv instance per process; compiled validators are cached by schema
// identity, since each tool's inputSchema is a stable singleton object. `strict`
// is off so harmless annotation keywords don't throw, mirroring how banira
// already drives ajv for CEM schema validation.
const ajv = new Ajv({ allErrors: true, strict: false });
const compiled = new WeakMap<object, ValidateFunction>();

function validatorFor(schema: object): ValidateFunction {
  let validate = compiled.get(schema);
  if (!validate) {
    validate = ajv.compile(schema);
    compiled.set(schema, validate);
  }
  return validate;
}

/**
 * Validate `args` against a tool's JSON Schema, returning precise path-level
 * messages on failure.
 */
export function validateArgs(schema: object, args: unknown): ValidationResult {
  const validate = validatorFor(schema);
  if (validate(args)) return { valid: true, errors: [] };
  const errors = (validate.errors ?? []).map((e) =>
    `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`.trim()
  );
  return { valid: false, errors };
}
