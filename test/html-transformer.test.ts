import * as ts from 'typescript';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { JSDOM } from 'jsdom';
import { lowerHtmlImports, isHtmlModuleNotFoundDiagnostic } from '../src/index.js';
import { compileFiles } from '../src/cli/actions/compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlDir = resolve(__dirname, 'fixtures/html');

function transform(source: string, html: string | undefined): string {
    const sourceFile = ts.createSourceFile('/proj/comp.ts', source, ts.ScriptTarget.Latest, true);
    const result = ts.transform(sourceFile, [lowerHtmlImports({ readHtml: () => html })]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(result.transformed[0]!);
}

describe('lowerHtmlImports (issue #28)', () => {
    it('lowers an HTML import to a module-level <template>', () => {
        const out = transform(`import tpl from './card.html';\n`, '<p class="x">hi</p>');
        assert.match(out, /const tpl = \(\(\) => \{/);
        assert.match(out, /const t = document\.createElement\("template"\)/);
        assert.match(out, /t\.innerHTML = "<p class=\\"x\\">hi<\/p>"/);
        assert.match(out, /return t;\n\s*\}\)\(\);/);
        assert.doesNotMatch(out, /import tpl/);
    });

    it('leaves an HTML import whose file cannot be read untouched', () => {
        const out = transform(`import tpl from './card.html';\n`, undefined);
        assert.match(out, /import tpl from ['"]\.\/card\.html['"]/);
    });

    it('does not touch non-HTML or binding-less imports', () => {
        const out = transform(`import { y } from './y.js';\nimport './side.html';\n`, '<p></p>');
        assert.match(out, /import \{ y \} from ['"]\.\/y\.js['"]/);
        assert.match(out, /import ['"]\.\/side\.html['"]/);
    });

    it('isHtmlModuleNotFoundDiagnostic matches only the HTML TS2307', () => {
        const html = { code: 2307, messageText: "Cannot find module './card.html' or its corresponding type declarations." } as ts.Diagnostic;
        const other = { code: 2307, messageText: "Cannot find module './util' or its corresponding type declarations." } as ts.Diagnostic;
        assert.strictEqual(isHtmlModuleNotFoundDiagnostic(html), true);
        assert.strictEqual(isHtmlModuleNotFoundDiagnostic(other), false);
    });

    it('compiles a component with an HTML import without errors and keeps the specifier un-mangled', () => {
        const outDir = mkdtempSync(resolve(tmpdir(), 'banira-html-'));
        const { ok, errors, outputs } = compileFiles([resolve(htmlDir, 'templated-card.ts')], { outDir });
        assert.strictEqual(ok, true, errors.map((e) => e.messageText).join('\n'));
        const js = readFileSync(outputs.find((f) => f.endsWith('templated-card.js'))!, 'utf8');
        assert.match(js, /document\.createElement\("template"\)/);
        assert.doesNotMatch(js, /card\.html/);
    });

    it('parses the template once and clones it per instance at runtime', () => {
        const html = readFileSync(resolve(htmlDir, 'card.html'), 'utf8');
        const code = transform(`import tpl from './card.html';\n`, html);
        const { window } = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
        window.eval(`(() => { ${code}\n window.__tpl = tpl; })()`);

        const tpl = (window as unknown as { __tpl: HTMLTemplateElement }).__tpl;
        assert.strictEqual(tpl.tagName, 'TEMPLATE');
        const a = tpl.content.cloneNode(true) as DocumentFragment;
        const b = tpl.content.cloneNode(true) as DocumentFragment;
        assert.notStrictEqual(a.firstChild, b.firstChild);
        assert.strictEqual(a.querySelector('slot')?.getAttribute('name'), 'title');
        assert.strictEqual(a.querySelector('p')?.textContent, '"Body" & ');
    });
});
