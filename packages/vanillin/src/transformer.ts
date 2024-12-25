import * as ts from 'typescript';

function appendJsToImports(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
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

export default function(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sourceFile: ts.SourceFile) => appendJsToImports(context)(sourceFile);
    };
}