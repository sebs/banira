import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    createPrerenderer,
    transformHtml,
    createEleventyPlugin,
    type Prerenderer,
    type EleventyConfigLike,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const circle = resolve(__dirname, '../examples/my-circle/my-circle.ts');

describe('createPrerenderer / renderToString (issue #42)', () => {
    let renderer: Prerenderer;
    before(async () => {
        renderer = await createPrerenderer([circle]);
    });
    after(() => renderer.close());

    it('lists the registered tags', () => {
        assert.deepStrictEqual(renderer.tags, ['my-circle']);
    });

    it('renders an element to DSD markup with attributes applied', async () => {
        const html = await renderer.renderToString('my-circle', { attributes: { size: '30' } });
        assert.match(html, /^<my-circle size="30"><template shadowrootmode="open">/);
        assert.match(html, /<svg/);
        assert.match(html, /<\/template><\/my-circle>$/);
    });

    it('preserves light-DOM children inside the host (after the template)', async () => {
        const html = await renderer.renderToString('my-circle', { attributes: { size: '20' }, children: 'Caption' });
        assert.match(html, /<\/template>Caption<\/my-circle>$/);
    });

    it('renders the same renderer repeatedly (register once, render many)', async () => {
        const a = await renderer.renderToString('my-circle', { attributes: { size: '10' } });
        const b = await renderer.renderToString('my-circle', { attributes: { size: '40' } });
        assert.match(a, /size="10"/);
        assert.match(b, /size="40"/);
    });
});

describe('transformHtml (11ty plugin core, issue #43)', () => {
    let renderer: Prerenderer;
    before(async () => {
        renderer = await createPrerenderer([circle]);
    });
    after(() => renderer.close());

    it('rewrites a matching tag into DSD, preserving attributes and children', async () => {
        const page = '<!DOCTYPE html><html><head></head><body><my-circle size="20">cap</my-circle></body></html>';
        const out = await transformHtml(page, renderer);
        assert.match(out, /<my-circle size="20"><template shadowrootmode="open">/);
        assert.match(out, /<\/template>cap<\/my-circle>/);
    });

    it('is idempotent — already-prerendered elements are left alone', async () => {
        const page = '<!DOCTYPE html><html><head></head><body><my-circle size="20">cap</my-circle></body></html>';
        const once = await transformHtml(page, renderer);
        const twice = await transformHtml(once, renderer);
        assert.strictEqual(twice, once);
    });

    it('returns the HTML untouched when no registered tag is present', async () => {
        const page = '<!DOCTYPE html><html><body><p>nothing here</p></body></html>';
        assert.strictEqual(await transformHtml(page, renderer), page);
    });
});

describe('createEleventyPlugin (issue #43)', () => {
    it('registers a transform that prerenders matching tags in .html output', async () => {
        let transformFn:
            | ((this: { outputPath?: string } | void, content: string, outputPath?: string) => Promise<string> | string)
            | undefined;
        const config: EleventyConfigLike = {
            addTransform(_name, fn) {
                transformFn = fn;
            },
            on() {
                /* capture only */
            },
        };

        createEleventyPlugin({ files: [circle] })(config);
        assert.ok(transformFn, 'plugin should register a transform');

        const html = '<!DOCTYPE html><html><body><my-circle size="15"></my-circle></body></html>';
        const out = await transformFn!.call({ outputPath: 'index.html' }, html);
        assert.match(out, /<my-circle size="15"><template shadowrootmode="open">/);

        // non-HTML output is passed through untouched
        const css = 'body{}';
        assert.strictEqual(await transformFn!.call({ outputPath: 'styles.css' }, css), css);
    });
});
