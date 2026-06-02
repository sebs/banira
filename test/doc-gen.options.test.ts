import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DocGen, type DocGenOptions } from '../src/doc-gen.js';

const FIXTURE = './test/fixtures/my-circle.ts';

async function render(options?: DocGenOptions): Promise<string> {
    const docGen = new DocGen('my-circle', options);
    const context = await docGen.parseDoc(FIXTURE);
    return docGen.renderDocs(context);
}

describe('DocGen output options', () => {
    it('default output is unchanged: ./dist src + PicoCSS link', async () => {
        const html = await render();
        assert.match(html, /<script type="module" src="\.\/dist\/my-circle\.js">/);
        assert.match(html, /cdn\.jsdelivr\.net\/npm\/@picocss\/pico/);
    });

    it('scriptSrc overrides the component module src', async () => {
        const html = await render({ scriptSrc: './my-circle.js' });
        assert.match(html, /<script type="module" src="\.\/my-circle\.js">/);
        assert.doesNotMatch(html, /\.\/dist\/my-circle\.js/);
    });

    it('stylesheet { href } sets a custom link instead of the CDN', async () => {
        const html = await render({ stylesheet: { href: '/styles/app.css' } });
        assert.match(html, /<link rel="stylesheet" href="\/styles\/app\.css">/);
        assert.doesNotMatch(html, /picocss/);
    });

    it('stylesheet { inline } inlines CSS with no external link', async () => {
        const html = await render({ stylesheet: { inline: 'body{color:red}' } });
        assert.match(html, /<style>\s*body\{color:red\}\s*<\/style>/);
        assert.doesNotMatch(html, /<link rel="stylesheet"/);
    });

    it("stylesheet 'none' produces an offline-safe page with no stylesheet", async () => {
        const html = await render({ stylesheet: 'none' });
        assert.doesNotMatch(html, /<link rel="stylesheet"/);
        assert.doesNotMatch(html, /picocss/);
        assert.doesNotMatch(html, /<style>/);
    });

    it('src getter reflects the scriptSrc option', () => {
        assert.strictEqual(new DocGen('x').src, './dist/x.js');
        assert.strictEqual(new DocGen('x', { scriptSrc: './out/x.js' }).src, './out/x.js');
    });
});
