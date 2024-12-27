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
 * @example
 * ```typescript
 * // Input:
 * import { foo } from './bar'
 * import { baz } from '@external/pkg'
 * 
 * // Output:
 * import { foo } from './bar.js'
 * import { baz } from '@external/pkg'
 * ```
 */
function appendJsToImports(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
    /**
     * Node visitor that processes import declarations
     * 
     * @param node - The TypeScript AST node to process
     * @returns The processed node, possibly with modified import path
     */
    const visitor = (node: ts.Node): ts.Node => {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const importPath = node.moduleSpecifier.text;
            // Skip if it already ends with .js or if it's an external module
            if (importPath.endsWith('.js') || importPath.startsWith('@') || !importPath.startsWith('.')) {
                return node;
            }
            const newModuleSpecifier = ts.factory.createStringLiteral(`${importPath}.js`);
            return ts.factory.createImportDeclaration(
                node.modifiers,
                node.importClause,
                newModuleSpecifier
            );
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
 * import { Compiler } from 'typescript';
 * 
 * const compiler = new Compiler({
 *   transformers: {
 *     before: [appendJsImportsTransformer()]
 *   }
 * });
 * ```
 */
export default function(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sourceFile: ts.SourceFile) => appendJsToImports(context)(sourceFile);
    };
}