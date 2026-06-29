import * as ts from 'typescript';

/**
 * A serializable projection of a `ts.Diagnostic`. The raw diagnostic holds AST
 * references and isn't JSON-safe, so the verify tools flatten it to this shape
 * (1-based line/column, matching `formatErrors` in the CLI's compile action).
 */
export interface DiagItem {
  code: number;
  category: 'error' | 'warning' | 'message';
  message: string;
  file: string | null;
  line: number | null;
  column: number | null;
}

/** Flatten a TypeScript diagnostic into the {@link DiagItem} wire shape. */
export function toDiagItem(d: ts.Diagnostic): DiagItem {
  const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  const category =
    d.category === ts.DiagnosticCategory.Error
      ? 'error'
      : d.category === ts.DiagnosticCategory.Warning
        ? 'warning'
        : 'message';
  if (d.file && d.start !== undefined) {
    const { line, character } = ts.getLineAndCharacterOfPosition(d.file, d.start);
    return { code: d.code, category, message, file: d.file.fileName, line: line + 1, column: character + 1 };
  }
  return { code: d.code, category, message, file: null, line: null, column: null };
}
