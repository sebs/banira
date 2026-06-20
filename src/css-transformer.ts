import * as ts from 'typescript';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

export interface CssLoweringOptions {
    /**
     * Reads the CSS at an absolute path, or returns `undefined` if it can't be
     * read (in which case the import is left untouched). Defaults to a
     * synchronous disk read; injectable for tests / virtual filesystems.
     */
    readCss?: (absolutePath: string) => string | undefined;
}

/** A relative `*.css` import specifier — the only kind we lower. */
function isCssSpecifier(specifier: string): boolean {
    return specifier.startsWith('.') && specifier.endsWith('.css');
}

const defaultReadCss = (absolutePath: string): string | undefined => {
    try {
        return readFileSync(absolutePath, 'utf8');
    } catch {
        return undefined;
    }
};

/**
 * Lowers a CSS import into a singleton constructable stylesheet so every
 * component instance shares one parse instead of an inline `<style>`:
 *
 * ```ts
 * import styles from './styles.css';              // #9: bare CSS import
 * import sheet from './styles.css' with { type: 'css' };  // #10: CSS Module Script syntax
 * ```
 *
 * both become, at the top of the emitted module:
 *
 * ```js
 * const styles = new CSSStyleSheet();
 * styles.replaceSync("…css…");
 * ```
 *
 * The binding is module-level, so all instances that `adoptedStyleSheets = [styles]`
 * share the one sheet. `adoptedStyleSheets` is Baseline widely available; the CSS
 * Module Script `with { type: 'css' }` syntax is not (Safari), which is why even
 * the standard form is shimmed here.
 *
 * Imports with no default binding, or whose CSS file can't be read, are left as-is.
 */
export function lowerCssImports(options: CssLoweringOptions = {}): ts.TransformerFactory<ts.SourceFile> {
    const readCss = options.readCss ?? defaultReadCss;

    return (context) => (sourceFile) => {
        const { factory } = context;
        const baseDir = dirname(sourceFile.fileName);
        let changed = false;

        const statements: ts.Statement[] = [];
        for (const statement of sourceFile.statements) {
            const lowered = tryLower(statement);
            if (lowered) {
                statements.push(...lowered);
                changed = true;
            } else {
                statements.push(statement);
            }
        }

        return changed ? factory.updateSourceFile(sourceFile, statements) : sourceFile;

        function tryLower(statement: ts.Statement): ts.Statement[] | undefined {
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return undefined;
            const specifier = statement.moduleSpecifier.text;
            if (!isCssSpecifier(specifier)) return undefined;

            const name = statement.importClause?.name; // the default-import binding
            if (!name) return undefined;

            const css = readCss(resolve(baseDir, specifier));
            if (css === undefined) return undefined;

            // const <name> = new CSSStyleSheet();
            const sheetConst = factory.createVariableStatement(
                undefined,
                factory.createVariableDeclarationList(
                    [
                        factory.createVariableDeclaration(
                            name,
                            undefined,
                            undefined,
                            factory.createNewExpression(factory.createIdentifier('CSSStyleSheet'), undefined, [])
                        ),
                    ],
                    ts.NodeFlags.Const
                )
            );

            // <name>.replaceSync("…css…");
            const replace = factory.createExpressionStatement(
                factory.createCallExpression(
                    factory.createPropertyAccessExpression(factory.createIdentifier(name.text), 'replaceSync'),
                    undefined,
                    [factory.createStringLiteral(css)]
                )
            );

            return [sheetConst, replace];
        }
    };
}

/**
 * True for the TS2307 "Cannot find module './x.css'" diagnostic raised because a
 * CSS import has no type declarations — expected, since banira lowers it at emit.
 */
export function isCssModuleNotFoundDiagnostic(diagnostic: ts.Diagnostic): boolean {
    if (diagnostic.code !== 2307) return false;
    const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    return /Cannot find module '\.[^']*\.css'/.test(text);
}
