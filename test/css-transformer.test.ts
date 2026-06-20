import * as ts from 'typescript';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { JSDOM } from 'jsdom';
import { lowerCssImports, isCssModuleNotFoundDiagnostic } from '../src/index.js';
import { compileFiles } from '../src/cli/actions/compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssDir = resolve(__dirname, 'fixtures/css');

function transform(source: string, css: string): string {
    const sourceFile = ts.createSourceFile('/proj/comp.ts', source, ts.ScriptTarget.Latest, true);
    const result = ts.transform(sourceFile, [lowerCssImports({ readCss: () => css })]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(result.transformed[0]!);
}

describe('lowerCssImports (issues #9, #10)', () => {
    it('lowers a bare CSS import to a constructable stylesheet', () => {
        const out = transform(`import styles from './x.css';\n`, '.a{color:red}');
        assert.match(out, /const styles = __baniraAdoptStyles\("\.a\{color:red\}"\)/);
        // the helper caches sheets on globalThis keyed by the CSS text
        assert.match(out, /globalThis\.__baniraStyleSheets/);
        assert.match(out, /\.replaceSync\(css\)/);
        assert.doesNotMatch(out, /import styles/);
    });

    it('lowers the CSS Module Script `with { type: \'css\' }` form the same way', () => {
        const out = transform(`import sheet from './x.css' with { type: 'css' };\n`, '.b{}');
        assert.match(out, /const sheet = __baniraAdoptStyles\("\.b\{\}"\)/);
        assert.doesNotMatch(out, /import sheet/);
    });

    it('emits the shared-cache helper only once even for multiple CSS imports', () => {
        const out = transform(`import a from './a.css';\nimport b from './b.css';\n`, '.x{}');
        assert.strictEqual(out.match(/const __baniraAdoptStyles =/g)?.length, 1);
        assert.match(out, /const a = __baniraAdoptStyles\(/);
        assert.match(out, /const b = __baniraAdoptStyles\(/);
    });

    it('leaves a CSS import whose file cannot be read untouched', () => {
        const sourceFile = ts.createSourceFile('/proj/comp.ts', `import s from './x.css';\n`, ts.ScriptTarget.Latest, true);
        const result = ts.transform(sourceFile, [lowerCssImports({ readCss: () => undefined })]);
        const out = ts.createPrinter().printFile(result.transformed[0]!);
        assert.match(out, /import s from ['"]\.\/x\.css['"]/);
    });

    it('does not touch non-CSS imports', () => {
        const out = transform(`import { y } from './y.js';\n`, 'ignored');
        assert.match(out, /import \{ y \} from ['"]\.\/y\.js['"]/);
    });

    it('isCssModuleNotFoundDiagnostic matches only the CSS TS2307', () => {
        const css = { code: 2307, messageText: "Cannot find module './styles.css' or its corresponding type declarations." } as ts.Diagnostic;
        const other = { code: 2307, messageText: "Cannot find module './util' or its corresponding type declarations." } as ts.Diagnostic;
        const unrelated = { code: 2304, messageText: 'Cannot find name foo.' } as ts.Diagnostic;
        assert.strictEqual(isCssModuleNotFoundDiagnostic(css), true);
        assert.strictEqual(isCssModuleNotFoundDiagnostic(other), false);
        assert.strictEqual(isCssModuleNotFoundDiagnostic(unrelated), false);
    });

    it('compiles a component with a CSS import without errors and inlines the sheet', () => {
        const outDir = mkdtempSync(resolve(tmpdir(), 'banira-css-'));
        const { ok, errors, outputs } = compileFiles([resolve(cssDir, 'styled-box.ts')], { outDir });
        assert.strictEqual(ok, true, errors.map((e) => e.messageText).join('\n'));
        assert.ok(outputs.some((f) => f.endsWith('styled-box.js')));
    });

    it('compiles the CSS Module Script `with { type: \'css\' }` form without errors', () => {
        const outDir = mkdtempSync(resolve(tmpdir(), 'banira-css-'));
        const { ok, errors } = compileFiles([resolve(cssDir, 'sheet-box.ts')], { outDir });
        assert.strictEqual(ok, true, errors.map((e) => e.messageText).join('\n'));
    });

    it('dedupes the sheet across modules: same CSS → one shared CSSStyleSheet (issue #30)', () => {
        // Two independently-lowered "modules" importing the same stylesheet.
        const css = '.a{color:red}';
        const moduleA = transform(`import a from './x.css';\n`, css);
        const moduleB = transform(`import b from './y.css';\n`, css);
        const moduleC = transform(`import c from './z.css';\n`, '.b{color:blue}');

        const { window } = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
        // Each module runs in its own scope (IIFE), sharing the window as globalThis.
        const run = (code: string, name: string, out: string) =>
            window.eval(`(() => { ${code}\n window.${out} = ${name}; })()`);
        run(moduleA, 'a', '__a');
        run(moduleB, 'b', '__b');
        run(moduleC, 'c', '__c');

        const w = window as unknown as Record<string, unknown>;
        assert.strictEqual(w.__a, w.__b, 'identical CSS across modules should share one sheet');
        assert.notStrictEqual(w.__a, w.__c, 'different CSS should produce a distinct sheet');
    });
});
