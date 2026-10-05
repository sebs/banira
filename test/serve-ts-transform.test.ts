import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import type { Server } from 'http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { transpileToEsm } from '../src/index.js';
import { serve } from '../src/cli/actions/serve.js';

describe('transpileToEsm', () => {
    it('strips type annotations and rewrites relative imports to .js', () => {
        const js = transpileToEsm(`import { dep } from './dep';\nexport class Widget { value: number = dep; }\n`);
        assert.match(js, /from ['"]\.\/dep\.js['"]/);
        assert.doesNotMatch(js, /: number/);
        assert.match(js, /class Widget/);
    });

    it('emits an inline source map with the original TypeScript embedded (issue #47)', () => {
        const source = `export class Widget { value: number = 1; }\n`;
        const js = transpileToEsm(source, 'widget.ts');
        const match = /sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/.exec(js);
        assert.ok(match, 'output should carry an inline base64 source map');
        const map = JSON.parse(Buffer.from(match![1]!, 'base64').toString('utf8'));
        assert.ok(map.sources?.[0]?.endsWith('widget.ts'), 'map should reference widget.ts');
        assert.ok(
            map.sourcesContent?.[0]?.includes('value: number'),
            'inlineSources should embed the original TypeScript'
        );
    });

    it('lowers CSS and HTML imports like Compiler does (issue #52)', () => {
        const files: Record<string, string> = { '/x/box.css': '.a{color:red}', '/x/card.html': '<p>hi</p>' };
        const js = transpileToEsm(
            `import styles from './box.css';\nimport tpl from './card.html';\nexport { styles, tpl };\n`,
            '/x/comp.ts',
            undefined,
            (path) => files[path]
        );
        assert.match(js, /const styles = __baniraAdoptStyles\("\.a\{color:red\}"\)/);
        assert.match(js, /t\.innerHTML = "<p>hi<\/p>"/);
        assert.doesNotMatch(js, /box\.css|card\.html/);
    });
});

describe('serve --ts (on-the-fly TypeScript)', () => {
    const PORT = 8151;
    const base = `http://127.0.0.1:${PORT}`;
    let server: Server;
    let dir: string;

    before(async () => {
        // <tmp>/root is served; <tmp>/outside.css sits beside it, out of the root.
        const parent = mkdtempSync(resolve(tmpdir(), 'banira-serve-ts-'));
        dir = resolve(parent, 'root');
        mkdirSync(dir);
        writeFileSync(resolve(parent, 'outside.css'), '.secret{}', 'utf8');
        writeFileSync(resolve(dir, 'box.css'), '.box{color:red}', 'utf8');
        writeFileSync(resolve(dir, 'styled.ts'), `import styles from './box.css';\nexport { styles };\n`, 'utf8');
        writeFileSync(resolve(dir, 'leaky.ts'), `import s from '../outside.css';\nexport { s };\n`, 'utf8');
        writeFileSync(resolve(dir, 'dep.ts'), `export const dep: number = 1;\n`, 'utf8');
        writeFileSync(
            resolve(dir, 'widget.ts'),
            `import { dep } from './dep';\nexport class Widget { value: number = dep; }\n`,
            'utf8'
        );
        server = serve(dir, { port: PORT, transformTs: true });
        await new Promise<void>((r) => server.once('listening', r));
    });

    after(async () => {
        await new Promise<void>((r) => server.close(() => r()));
        rmSync(resolve(dir, '..'), { recursive: true, force: true });
    });

    it('serves a .ts request as transpiled ES module', async () => {
        const res = await fetch(`${base}/widget.ts`);
        assert.strictEqual(res.status, 200);
        assert.match(res.headers.get('content-type') ?? '', /javascript/);
        const body = await res.text();
        assert.match(body, /from ['"]\.\/dep\.js['"]/);
        assert.doesNotMatch(body, /: number/);
    });

    it('inlines CSS imports from inside the served root (issue #52)', async () => {
        const body = await (await fetch(`${base}/styled.ts`)).text();
        assert.match(body, /__baniraAdoptStyles\("\.box\{color:red\}"\)/);
        assert.doesNotMatch(body, /box\.css/);
    });

    it('does not inline a CSS import from outside the served root', async () => {
        const body = await (await fetch(`${base}/leaky.ts`)).text();
        assert.doesNotMatch(body, /\.secret/);
        assert.match(body, /from ['"]\.\.\/outside\.css['"]/);
    });

    it('maps a .js request to a sibling .ts when no compiled .js exists', async () => {
        const res = await fetch(`${base}/widget.js`);
        assert.strictEqual(res.status, 200);
        assert.match(res.headers.get('content-type') ?? '', /javascript/);
        const body = await res.text();
        assert.match(body, /class Widget/);
    });
});
