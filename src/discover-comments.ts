import {
    Node,
    SyntaxKind,
    CommentRange,
    getLeadingCommentRanges
} from 'typescript';
import { TextRange } from '@microsoft/tsdoc';

export interface IFoundComment {
    compilerNode: Node;
    textRange: TextRange;
}

function isDeclarationKind(kind: SyntaxKind): boolean {
    switch (kind) {
        case SyntaxKind.ArrowFunction:
        case SyntaxKind.BindingElement:
        case SyntaxKind.ClassDeclaration:
        case SyntaxKind.ClassExpression:
        case SyntaxKind.Constructor:
        case SyntaxKind.EnumDeclaration:
        case SyntaxKind.EnumMember:
        case SyntaxKind.ExportSpecifier:
        case SyntaxKind.FunctionDeclaration:
        case SyntaxKind.FunctionExpression:
        case SyntaxKind.GetAccessor:
        case SyntaxKind.ImportEqualsDeclaration:
        case SyntaxKind.ImportSpecifier:
        case SyntaxKind.InterfaceDeclaration:
        case SyntaxKind.JsxAttribute:
        case SyntaxKind.MethodDeclaration:
        case SyntaxKind.MethodSignature:
        case SyntaxKind.ModuleDeclaration:
        case SyntaxKind.NamespaceExportDeclaration:
        case SyntaxKind.NamespaceImport:
        case SyntaxKind.Parameter:
        case SyntaxKind.PropertyAssignment:
        case SyntaxKind.PropertyDeclaration:
        case SyntaxKind.PropertySignature:
        case SyntaxKind.SetAccessor:
        case SyntaxKind.ShorthandPropertyAssignment:
        case SyntaxKind.TypeAliasDeclaration:
        case SyntaxKind.TypeParameter:
        case SyntaxKind.VariableDeclaration:
        case SyntaxKind.JSDocTypedefTag:
        case SyntaxKind.JSDocCallbackTag:
        case SyntaxKind.JSDocPropertyTag:
            return true;
    }
    return false;
}

function getJSDocCommentRanges(node: Node, text: string): CommentRange[] {
    const commentRanges: CommentRange[] = [];

    switch (node.kind) {
        case SyntaxKind.Parameter:
        case SyntaxKind.TypeParameter:
        case SyntaxKind.FunctionExpression:
        case SyntaxKind.ArrowFunction:
        case SyntaxKind.ParenthesizedExpression:
            return commentRanges;
    }

    // Collect comment ranges
    const ranges: CommentRange[] | undefined = getLeadingCommentRanges(text, node.getFullStart());
    if (ranges) {
        commentRanges.push(...ranges);
    }

    return commentRanges;
}

/**
 * Recursively walks a TypeScript AST and returns the JSDoc comments associated
 * with declaration nodes.
 *
 * @param node - The TypeScript AST node to analyze (typically a source file)
 * @returns The discovered comments, in document order.
 */
export function discoverComments(node: Node): IFoundComment[] {
    const buffer: string = node.getSourceFile().getFullText(); // don't use getText() here!
    const own: IFoundComment[] = isDeclarationKind(node.kind)
        ? getJSDocCommentRanges(node, buffer).map((comment) => ({
              compilerNode: node,
              textRange: TextRange.fromStringRange(buffer, comment.pos, comment.end),
          }))
        : [];

    const children: IFoundComment[] = [];
    node.forEachChild((child) => { children.push(...discoverComments(child)); });
    return [...own, ...children];
}
