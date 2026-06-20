import * as ts from 'typescript';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createRequire } from 'module';

export interface CssLoweringOptions {
    /**
     * Reads the CSS at an absolute path, or returns `undefined` if it can't be
     * read (in which case the import is left untouched). Defaults to a
     * synchronous disk read; injectable for tests / virtual filesystems.
     */
    readCss?: (absolutePath: string) => string | undefined;
    /**
     * Run the inlined CSS through [lightningcss](https://lightningcss.dev/)
     * before `replaceSync` — lower CSS nesting for the target browsers and
     * minify (#10). (`@import` is left as-is: this uses lightningcss `transform`,
     * which does not resolve/bundle imports.) lightningcss is an optional dependency, loaded
     * lazily (like Playwright/axe); a clear error is thrown if it's missing.
     */
    optimizeCss?: boolean;
    /** lightningcss `targets` (e.g. from its `browserslistToTargets`); narrows nesting lowering. */
    cssTargets?: unknown;
    /**
     * Overrides the CSS optimizer (default: lightningcss when `optimizeCss` is
     * set). Injectable for tests and custom pipelines.
     */
    transformCss?: (css: string, filename: string) => string;
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

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Resolves the CSS optimizer for the lowering: the injected `transformCss`, or a
 * lightningcss-backed one when `optimizeCss` is set (loaded lazily on first use,
 * so a project with no CSS imports never needs the dependency), or `undefined`.
 */
function makeCssOptimizer(options: CssLoweringOptions): ((css: string, filename: string) => string) | undefined {
    if (options.transformCss) return options.transformCss;
    if (!options.optimizeCss) return undefined;

    let transform: ((opts: Record<string, unknown>) => { code: { toString(): string } }) | undefined;
    return (css: string, filename: string): string => {
        if (!transform) {
            // A non-literal specifier keeps TypeScript from requiring the optional dep at build time.
            const specifier = 'lightningcss';
            try {
                transform = (createRequire(import.meta.url)(specifier) as any).transform;
            } catch {
                throw new Error('CSS optimization requires lightningcss. Install it with `npm i -D lightningcss`.');
            }
        }
        const result = transform!({
            filename,
            code: Buffer.from(css),
            minify: true,
            ...(options.cssTargets ? { targets: options.cssTargets } : {}),
        });
        return result.code.toString();
    };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Name of the per-module helper that resolves a constructable sheet from the shared cache. */
const HELPER_NAME = '__baniraAdoptStyles';

/**
 * Builds the shared-cache helper, prepended once to any module with a lowered
 * CSS import:
 *
 * ```js
 * const __baniraAdoptStyles = (css) => {
 *     const cache = globalThis.__baniraStyleSheets || (globalThis.__baniraStyleSheets = new Map());
 *     let sheet = cache.get(css);
 *     if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(css); cache.set(css, sheet); }
 *     return sheet;
 * };
 * ```
 *
 * It memoizes constructable stylesheets in a `Map` on `globalThis` keyed by the
 * CSS text, so two modules importing the same `theme.css` adopt the *same*
 * `CSSStyleSheet` (#9). Built with the synthetic-node factory so it is safe for
 * the emit resolver (a node parsed from a separate source file is not).
 */
function helperStatement(factory: ts.NodeFactory): ts.Statement {
    const css = factory.createIdentifier('css');
    const cache = factory.createIdentifier('cache');
    const sheet = factory.createIdentifier('sheet');
    const globalRef = (): ts.Expression =>
        factory.createPropertyAccessExpression(factory.createIdentifier('globalThis'), '__baniraStyleSheets');

    // const cache = globalThis.__baniraStyleSheets || (globalThis.__baniraStyleSheets = new Map());
    const cacheDecl = factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [
                factory.createVariableDeclaration(
                    cache,
                    undefined,
                    undefined,
                    factory.createBinaryExpression(
                        globalRef(),
                        ts.SyntaxKind.BarBarToken,
                        factory.createParenthesizedExpression(
                            factory.createAssignment(
                                globalRef(),
                                factory.createNewExpression(factory.createIdentifier('Map'), undefined, [])
                            )
                        )
                    )
                ),
            ],
            ts.NodeFlags.Const
        )
    );

    // let sheet = cache.get(css);
    const sheetDecl = factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [
                factory.createVariableDeclaration(
                    sheet,
                    undefined,
                    undefined,
                    factory.createCallExpression(factory.createPropertyAccessExpression(cache, 'get'), undefined, [css])
                ),
            ],
            ts.NodeFlags.Let
        )
    );

    // if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(css); cache.set(css, sheet); }
    const ifMissing = factory.createIfStatement(
        factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, sheet),
        factory.createBlock(
            [
                factory.createExpressionStatement(
                    factory.createAssignment(
                        sheet,
                        factory.createNewExpression(factory.createIdentifier('CSSStyleSheet'), undefined, [])
                    )
                ),
                factory.createExpressionStatement(
                    factory.createCallExpression(factory.createPropertyAccessExpression(sheet, 'replaceSync'), undefined, [css])
                ),
                factory.createExpressionStatement(
                    factory.createCallExpression(factory.createPropertyAccessExpression(cache, 'set'), undefined, [css, sheet])
                ),
            ],
            true
        )
    );

    const arrow = factory.createArrowFunction(
        undefined,
        undefined,
        [factory.createParameterDeclaration(undefined, undefined, css)],
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        factory.createBlock([cacheDecl, sheetDecl, ifMissing, factory.createReturnStatement(sheet)], true)
    );

    return factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [factory.createVariableDeclaration(factory.createIdentifier(HELPER_NAME), undefined, undefined, arrow)],
            ts.NodeFlags.Const
        )
    );
}

/**
 * Lowers a CSS import into a shared, deduped constructable stylesheet so every
 * component instance — and every *module* — shares one parse instead of an
 * inline `<style>`:
 *
 * ```ts
 * import styles from './styles.css';              // #9: bare CSS import
 * import sheet from './styles.css' with { type: 'css' };  // #10: CSS Module Script syntax
 * ```
 *
 * become, in the emitted module:
 *
 * ```js
 * const __baniraAdoptStyles = (css) => { … cache on globalThis … };
 * const styles = __baniraAdoptStyles("…css…");
 * ```
 *
 * The binding is module-level (all instances that `adoptedStyleSheets = [styles]`
 * share the one sheet), and the helper's cache lives on `globalThis` keyed by the
 * CSS text, so two different modules importing the same stylesheet adopt the
 * **same** `CSSStyleSheet` — the documented `adoptedStyleSheets` dedupe win.
 * `adoptedStyleSheets` is Baseline widely available; the CSS Module Script
 * `with { type: 'css' }` syntax is not (Safari), which is why even the standard
 * form is shimmed here.
 *
 * Imports with no default binding, or whose CSS file can't be read, are left as-is.
 */
export function lowerCssImports(options: CssLoweringOptions = {}): ts.TransformerFactory<ts.SourceFile> {
    const readCss = options.readCss ?? defaultReadCss;
    const optimizeCss = makeCssOptimizer(options);

    return (context) => (sourceFile) => {
        const { factory } = context;
        const baseDir = dirname(sourceFile.fileName);
        let changed = false;

        const statements: ts.Statement[] = [];
        for (const statement of sourceFile.statements) {
            const lowered = tryLower(statement);
            if (lowered) {
                statements.push(lowered);
                changed = true;
            } else {
                statements.push(statement);
            }
        }

        // Prepend the shared-cache helper once, ahead of its first use.
        if (changed) statements.unshift(helperStatement(factory));

        return changed ? factory.updateSourceFile(sourceFile, statements) : sourceFile;

        function tryLower(statement: ts.Statement): ts.Statement | undefined {
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return undefined;
            const specifier = statement.moduleSpecifier.text;
            if (!isCssSpecifier(specifier)) return undefined;

            const name = statement.importClause?.name; // the default-import binding
            if (!name) return undefined;

            const absolutePath = resolve(baseDir, specifier);
            const raw = readCss(absolutePath);
            if (raw === undefined) return undefined;
            const css = optimizeCss ? optimizeCss(raw, absolutePath) : raw;

            // const <name> = __baniraAdoptStyles("…css…");
            return factory.createVariableStatement(
                undefined,
                factory.createVariableDeclarationList(
                    [
                        factory.createVariableDeclaration(
                            name,
                            undefined,
                            undefined,
                            factory.createCallExpression(factory.createIdentifier(HELPER_NAME), undefined, [
                                factory.createStringLiteral(css),
                            ])
                        ),
                    ],
                    ts.NodeFlags.Const
                )
            );
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
