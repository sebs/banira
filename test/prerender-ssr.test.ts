import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import {
    createPrerenderer,
    transformHtml,
    createEleventyPlugin,
    scaffoldComponent,
    type Prerenderer,
    type EleventyConfigLike,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const circle = resolve(__dirname, '../examples/my-circle/my-circle.ts');

/** Scaffolds a component that adopts a constructable stylesheet (the hydrate variant). */
function adoptingComponent(tag: string): string {
    const dir = mkdtempSync(resolve(tmpdir(), 'banira-critical-'));
    for (const file of scaffoldComponent(tag, { hydrate: true })) writeFileSync(join(dir, file.path), file.content, 'utf8');
    return join(dir, `${tag}.ts`);
}

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

describe('critical-CSS inlining into DSD (issue #44)', () => {
    it('inlines adopted constructable styles as <style data-banira-critical> by default', async () => {
        const renderer = await createPrerenderer([adoptingComponent('crit-a')]);
        const html = await renderer.renderToString('crit-a', { attributes: { value: 'Hi' } });
        renderer.close();
        assert.match(html, /<template shadowrootmode="open"><style data-banira-critical>:host/);
        // critical style precedes the prerendered content (styled before JS)
        assert.ok(html.indexOf('data-banira-critical') < html.indexOf('part="label"'));
    });

    it('omits the inline critical CSS when inlineStyles is false', async () => {
        const renderer = await createPrerenderer([adoptingComponent('crit-b')], { inlineStyles: false });
        const html = await renderer.renderToString('crit-b', { attributes: { value: 'Hi' } });
        renderer.close();
        assert.doesNotMatch(html, /data-banira-critical/);
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
