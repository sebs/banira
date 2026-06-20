import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import {
    isBareSpecifier,
    packageNameOf,
    scanSpecifiers,
    collectBareSpecifiers,
    generateImportMap,
    buildImportMap,
    importMapScript,
    findModuleFiles,
} from '../src/index.js';
import { serve, type ReloadableServer } from '../src/cli/actions/serve.js';

describe('import map — specifier classification (issue #48)', () => {
    it('distinguishes bare specifiers from paths, URLs and node builtins', () => {
        assert.strictEqual(isBareSpecifier('lit'), true);
        assert.strictEqual(isBareSpecifier('@lit/reactive-element'), true);
        assert.strictEqual(isBareSpecifier('./local.js'), false);
        assert.strictEqual(isBareSpecifier('/abs.js'), false);
        assert.strictEqual(isBareSpecifier('https://esm.sh/lit'), false);
        assert.strictEqual(isBareSpecifier('node:fs'), false);
    });

    it('derives the package name from a subpath or scoped specifier', () => {
        assert.strictEqual(packageNameOf('lit'), 'lit');
        assert.strictEqual(packageNameOf('lit/decorators.js'), 'lit');
        assert.strictEqual(packageNameOf('@lit/reactive-element/decorators.js'), '@lit/reactive-element');
    });
});

describe('import map — scanning', () => {
    it('finds static, re-export and dynamic import specifiers', () => {
        const src = `
            import { html } from 'lit';
            import './local.js';
            export { x } from '@scope/pkg/sub.js';
            const m = await import('dynamic-dep');
        `;
        const specs = scanSpecifiers(src);
        assert.deepStrictEqual(
            specs.sort(),
            ['./local.js', '@scope/pkg/sub.js', 'dynamic-dep', 'lit'].sort()
        );
    });

    it('walks the local graph to gather bare specifiers across modules', () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-im-'));
        writeFileSync(join(dir, 'entry.ts'), `import './child.js';\nimport 'lit';\n`, 'utf8');
        writeFileSync(join(dir, 'child.ts'), `import { x } from '@scope/pkg/sub.js';\n`, 'utf8');
        const bare = collectBareSpecifiers([join(dir, 'entry.ts')], { recursive: true });
        assert.deepStrictEqual(bare, ['@scope/pkg/sub.js', 'lit']);
    });

    it('without recursion scans only the listed files', () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-im-'));
        writeFileSync(join(dir, 'entry.ts'), `import './child.js';\nimport 'lit';\n`, 'utf8');
        writeFileSync(join(dir, 'child.ts'), `import 'only-in-child';\n`, 'utf8');
        assert.deepStrictEqual(collectBareSpecifiers([join(dir, 'entry.ts')]), ['lit']);
    });
});

describe('import map — generation', () => {
    const packageJson = { dependencies: { lit: '^3.1.0' }, devDependencies: { '@scope/pkg': '2.0.0' } };

    it('pins packages to esm.sh at the package.json version, with bare + prefix entries', () => {
        const map = generateImportMap(['lit', 'lit/decorators.js'], { packageJson });
        assert.strictEqual(map.imports['lit'], 'https://esm.sh/lit@3.1.0');
        assert.strictEqual(map.imports['lit/'], 'https://esm.sh/lit@3.1.0/');
    });

    it('resolves scoped packages and devDependencies', () => {
        const map = generateImportMap(['@scope/pkg/sub.js'], { packageJson });
        assert.strictEqual(map.imports['@scope/pkg'], 'https://esm.sh/@scope/pkg@2.0.0');
        assert.strictEqual(map.imports['@scope/pkg/'], 'https://esm.sh/@scope/pkg@2.0.0/');
    });

    it('leaves a package unpinned when no version is known', () => {
        const map = generateImportMap(['unknown-dep'], { packageJson });
        assert.strictEqual(map.imports['unknown-dep'], 'https://esm.sh/unknown-dep');
    });

    it('honors a custom CDN base', () => {
        const map = generateImportMap(['lit'], { packageJson, cdn: 'https://cdn.example/' });
        assert.strictEqual(map.imports['lit'], 'https://cdn.example/lit@3.1.0');
    });

    it('renders an importmap script tag', () => {
        const tag = importMapScript(generateImportMap(['lit'], { packageJson }));
        assert.match(tag, /^<script type="importmap">/);
        assert.match(tag, /"lit": "https:\/\/esm\.sh\/lit@3\.1\.0"/);
    });

    it('buildImportMap scans files and pins from an explicit package.json', () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-im-'));
        writeFileSync(join(dir, 'c.ts'), `import 'lit';\n`, 'utf8');
        const map = buildImportMap([join(dir, 'c.ts')], { packageJson });
        assert.strictEqual(map.imports['lit'], 'https://esm.sh/lit@3.1.0');
    });

    it('findModuleFiles enumerates modules and skips node_modules', () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-im-'));
        writeFileSync(join(dir, 'a.js'), '', 'utf8');
        mkdirSync(join(dir, 'node_modules', 'x'), { recursive: true });
        writeFileSync(join(dir, 'node_modules', 'x', 'b.js'), '', 'utf8');
        const found = findModuleFiles(dir);
        assert.deepStrictEqual(found, [join(dir, 'a.js')]);
    });
});

describe('serve --import-map injection', () => {
    const PORT = 8161;
    let server: ReloadableServer;
    let dir: string;

    before(async () => {
        dir = mkdtempSync(resolve(tmpdir(), 'banira-im-serve-'));
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { lit: '^3.1.0' } }), 'utf8');
        writeFileSync(join(dir, 'app.js'), `import { html } from 'lit';\nconsole.log(html);\n`, 'utf8');
        writeFileSync(
            join(dir, 'index.html'),
            `<!DOCTYPE html><html><head><title>t</title></head><body><script type="module" src="./app.js"></script></body></html>`,
            'utf8'
        );
        server = serve(dir, { port: PORT, importMap: true });
        await new Promise<void>((res) => server.once('listening', () => res()));
    });

    after(async () => {
        await new Promise<void>((res) => server.close(() => res()));
    });

    it('injects a pinned importmap before the first module script', async () => {
        const body = await (await fetch(`http://127.0.0.1:${PORT}/`)).text();
        assert.match(body, /<script type="importmap">/);
        assert.match(body, /"lit": "https:\/\/esm\.sh\/lit@3\.1\.0"/);
        // the import map must precede the module script that relies on it
        assert.ok(body.indexOf('type="importmap"') < body.indexOf('src="./app.js"'));
    });
});
