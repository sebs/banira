import * as ts from 'typescript';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

export interface HtmlLoweringOptions {
    /**
     * Reads the HTML at an absolute path, or returns `undefined` if it can't be
     * read (in which case the import is left untouched). Defaults to a
     * synchronous disk read; injectable for tests / virtual filesystems.
     */
    readHtml?: (absolutePath: string) => string | undefined;
}

/** A relative `*.html` import specifier — the only kind we lower. */
function isHtmlSpecifier(specifier: string): boolean {
    return specifier.startsWith('.') && specifier.endsWith('.html');
}

const defaultReadHtml = (absolutePath: string): string | undefined => {
    try {
        return readFileSync(absolutePath, 'utf8');
    } catch {
        return undefined;
    }
};

/**
 * Builds the module-level template initializer:
 *
 * ```js
 * (() => { const t = document.createElement("template"); t.innerHTML = "…html…"; return t; })()
 * ```
 *
 * Built with the synthetic-node factory so it is safe for the emit resolver.
 */
function templateExpression(factory: ts.NodeFactory, html: string): ts.Expression {
    const t = factory.createIdentifier('t');
    const body = factory.createBlock(
        [
            // const t = document.createElement("template");
            factory.createVariableStatement(
                undefined,
                factory.createVariableDeclarationList(
                    [
                        factory.createVariableDeclaration(
                            t,
                            undefined,
                            undefined,
                            factory.createCallExpression(
                                factory.createPropertyAccessExpression(factory.createIdentifier('document'), 'createElement'),
                                undefined,
                                [factory.createStringLiteral('template')]
                            )
                        ),
                    ],
                    ts.NodeFlags.Const
                )
            ),
            // t.innerHTML = "…html…";
            factory.createExpressionStatement(
                factory.createAssignment(factory.createPropertyAccessExpression(t, 'innerHTML'), factory.createStringLiteral(html))
            ),
            factory.createReturnStatement(t),
        ],
        true
    );
    const arrow = factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        body
    );
    return factory.createCallExpression(factory.createParenthesizedExpression(arrow), undefined, []);
}

/**
 * Lowers an HTML import into a module-level `<template>` that is parsed once,
 * so every component instance clones it instead of re-parsing markup — the
 * markup analog of the constructable-stylesheet lowering in `lowerCssImports`:
 *
 * ```ts
 * import tpl from './card.html';
 * // …in the constructor:
 * root.appendChild(tpl.content.cloneNode(true));
 * ```
 *
 * becomes, in the emitted module:
 *
 * ```js
 * const tpl = (() => { const t = document.createElement("template"); t.innerHTML = "…html…"; return t; })();
 * ```
 *
 * The HTML file is read at compile time and inlined as a JS string literal (it
 * is author-controlled source, like the component itself). Imports with no
 * default binding, or whose HTML file can't be read, are left as-is.
 */
export function lowerHtmlImports(options: HtmlLoweringOptions = {}): ts.TransformerFactory<ts.SourceFile> {
    const readHtml = options.readHtml ?? defaultReadHtml;

    return (context) => (sourceFile) => {
        const { factory } = context;
        const baseDir = dirname(sourceFile.fileName);
        let changed = false;

        const statements = sourceFile.statements.map((statement) => {
            const lowered = tryLower(statement);
            if (!lowered) return statement;
            changed = true;
            return lowered;
        });

        return changed ? factory.updateSourceFile(sourceFile, statements) : sourceFile;

        function tryLower(statement: ts.Statement): ts.Statement | undefined {
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return undefined;
            const specifier = statement.moduleSpecifier.text;
            if (!isHtmlSpecifier(specifier)) return undefined;

            const name = statement.importClause?.name; // the default-import binding
            if (!name) return undefined;

            const html = readHtml(resolve(baseDir, specifier));
            if (html === undefined) return undefined;

            // const <name> = (() => { … template … })();
            return factory.createVariableStatement(
                undefined,
                factory.createVariableDeclarationList(
                    [factory.createVariableDeclaration(name, undefined, undefined, templateExpression(factory, html))],
                    ts.NodeFlags.Const
                )
            );
        }
    };
}

/**
 * True for the TS2307 "Cannot find module './x.html'" diagnostic raised because
 * an HTML import has no type declarations — expected, since banira lowers it at emit.
 */
export function isHtmlModuleNotFoundDiagnostic(diagnostic: ts.Diagnostic): boolean {
    if (diagnostic.code !== 2307) return false;
    const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    return /Cannot find module '\.[^']*\.html'/.test(text);
}
