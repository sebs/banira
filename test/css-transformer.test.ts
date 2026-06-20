import * as ts from 'typescript';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
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
        assert.match(out, /const styles = new CSSStyleSheet\(\)/);
        assert.match(out, /styles\.replaceSync\("\.a\{color:red\}"\)/);
        assert.doesNotMatch(out, /import styles/);
    });

    it('lowers the CSS Module Script `with { type: \'css\' }` form the same way', () => {
        const out = transform(`import sheet from './x.css' with { type: 'css' };\n`, '.b{}');
        assert.match(out, /const sheet = new CSSStyleSheet\(\)/);
        assert.match(out, /sheet\.replaceSync/);
        assert.doesNotMatch(out, /import sheet/);
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
});
