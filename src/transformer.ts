import * as ts from 'typescript';

/**
 * Creates a TypeScript transformer that appends '.js' to relative import paths
 * 
 * @remarks
 * This transformer modifies import declarations in TypeScript files to ensure
 * that relative imports have the '.js' extension. This is particularly useful
 * when working with ES modules in the browser, where file extensions are required.
 * 
 * The transformer will:
 * - Only modify relative imports (starting with '.')
 * - Skip imports that already end with '.js'
 * - Skip external module imports (starting with '@' or non-relative paths)
 * 
 * @param context - The TypeScript transformation context
 * @returns A transformer function for TypeScript source files
 * 
 * It also covers re-exports (`export { x } from './y'`, `export * from './y'`)
 * and dynamic imports (`import('./y')`), since those break in the browser for
 * the same reason static imports do.
 *
 * @example
 * ```typescript
 * // Input:
 * import { foo } from './bar'
 * export { qux } from './qux'
 * const mod = await import('./lazy')
 * import { baz } from '@external/pkg'
 *
 * // Output:
 * import { foo } from './bar.js'
 * export { qux } from './qux.js'
 * const mod = await import('./lazy.js')
 * import { baz } from '@external/pkg'
 * ```
 */
function appendJsToImports(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
    /**
     * Determines whether a module specifier should have '.js' appended:
     * relative paths that don't already carry the extension.
     */
    const needsJsExtension = (specifier: string): boolean =>
        specifier.startsWith('.') &&
        !specifier.startsWith('@') &&
        !specifier.endsWith('.js') &&
        // Asset imports (e.g. `.css`) are handled by their own lowering; never
        // rewrite `./styles.css` to `./styles.css.js`.
        !specifier.endsWith('.css');

    /**
     * Returns true for the `import(...)` form of a call expression
     * (dynamic import), as opposed to a regular function call.
     */
    const isDynamicImport = (node: ts.CallExpression): boolean =>
        node.expression.kind === ts.SyntaxKind.ImportKeyword;

    /**
     * Node visitor that processes import, re-export, and dynamic-import nodes
     *
     * @param node - The TypeScript AST node to process
     * @returns The processed node, possibly with modified module path
     */
    const visitor = (node: ts.Node): ts.Node => {
        // import ... from './x'
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            const path = node.moduleSpecifier.text;
            if (needsJsExtension(path)) {
                return ts.factory.updateImportDeclaration(
                    node,
                    node.modifiers,
                    node.importClause,
                    ts.factory.createStringLiteral(`${path}.js`),
                    node.attributes
                );
            }
            return node;
        }

        // export { x } from './x'  /  export * from './x'
        if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const path = node.moduleSpecifier.text;
            if (needsJsExtension(path)) {
                return ts.factory.updateExportDeclaration(
                    node,
                    node.modifiers,
                    node.isTypeOnly,
                    node.exportClause,
                    ts.factory.createStringLiteral(`${path}.js`),
                    node.attributes
                );
            }
            return node;
        }

        // import('./x')
        if (ts.isCallExpression(node) && isDynamicImport(node) && node.arguments.length > 0) {
            const [specifier, ...rest] = node.arguments;
            if (specifier && ts.isStringLiteral(specifier) && needsJsExtension(specifier.text)) {
                return ts.factory.updateCallExpression(
                    node,
                    node.expression,
                    node.typeArguments,
                    [ts.factory.createStringLiteral(`${specifier.text}.js`), ...rest]
                );
            }
        }

        return ts.visitEachChild(node, visitor, context);
    };

    return (sourceFile: ts.SourceFile) => ts.visitNode(sourceFile, visitor) as ts.SourceFile;
}

/**
 * Creates a transformer factory for appending '.js' to relative imports
 * 
 * @remarks
 * This is the main export of the transformer module. It creates a transformer
 * factory that can be used with the TypeScript compiler API to process import
 * declarations in source files.
 * 
 * @returns A TypeScript transformer factory
 *
 * @example
 * ```typescript
 * import appendJsImports from './transformer.js';
 *
 * program.emit(undefined, undefined, undefined, undefined, {
 *   after: [appendJsImports()]
 * });
 * ```
 */
export default function(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sourceFile: ts.SourceFile) => appendJsToImports(context)(sourceFile);
    };
}