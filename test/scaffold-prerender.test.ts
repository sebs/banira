import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { smokeTestManifest, scaffoldComponent, prerenderManifest, declarativeShadowDom } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const circle = resolve(__dirname, '../examples/my-circle/my-circle.ts');

describe('scaffoldComponent (Tier 5)', () => {
    it('generates a component source and a demo page', () => {
        const files = scaffoldComponent('my-widget');
        const paths = files.map((f) => f.path).sort();
        assert.deepStrictEqual(paths, ['index.html', 'my-widget.ts']);
        const component = files.find((f) => f.path === 'my-widget.ts')!.content;
        assert.match(component, /class MyWidget extends HTMLElement/);
        assert.match(component, /customElements\.define\('my-widget', MyWidget\)/);
        assert.match(component, /@fires my-widget-change/);
        const demo = files.find((f) => f.path === 'index.html')!.content;
        assert.match(demo, /<my-widget /);
        assert.match(demo, /\.\/dist\/my-widget\.js/);
    });

    it('rejects an invalid tag name', () => {
        assert.throws(() => scaffoldComponent('NoHyphen'), /not a valid custom element name/);
    });

    it('scaffolds a component that passes its own smoke test', async () => {
        const dir = mkdtempSync(resolve(tmpdir(), 'banira-scaffold-'));
        for (const file of scaffoldComponent('round-trip')) {
            writeFileSync(resolve(dir, file.path), file.content, 'utf8');
        }
        const results = await smokeTestManifest([resolve(dir, 'round-trip.ts')]);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0]!.ok, true, results[0]!.error);
    });
});

describe('prerenderManifest (Tier 5)', () => {
    it('wraps shadow DOM in a declarative shadow root template', async () => {
        const results = await prerenderManifest([circle], { attributes: { size: '40' } });
        assert.strictEqual(results.length, 1);
        const html = results[0]!.html;
        assert.match(html, /<my-circle size="40">/);
        assert.match(html, /<template shadowrootmode="open">/);
        assert.match(html, /<svg/);
    });

    it('declarativeShadowDom composes the template markup', () => {
        const html = declarativeShadowDom('x-y', '<p>hi</p>', { a: 'b' });
        assert.strictEqual(html, '<x-y a="b"><template shadowrootmode="open"><p>hi</p></template></x-y>');
    });
});
