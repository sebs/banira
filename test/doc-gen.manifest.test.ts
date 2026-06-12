import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { DocGen } from '../src/doc-gen.js';

describe('DocGen.generate (manifest-backed API reference)', () => {
    let page: string;

    before(async () => {
        const docGen = new DocGen('rating-widget');
        page = await docGen.generate('./test/fixtures/rich-element.ts');
    });

    it('renders an Attributes section with the observed attributes', () => {
        assert.match(page, /<h2 id="[^"]+">Attributes<\/h2>/);
        assert.match(page, /<code>value<\/code>/);
        assert.match(page, /<code>max<\/code>/);
    });

    it('renders a Properties section', () => {
        assert.match(page, /<h2 id="[^"]+">Properties<\/h2>/);
    });

    it('renders a Methods section with public methods', () => {
        assert.match(page, /<h2 id="[^"]+">Methods<\/h2>/);
        assert.match(page, /<code>reset<\/code>/);
    });

    it('renders an Events section from CustomEvent + @fires', () => {
        assert.match(page, /<h2 id="[^"]+">Events<\/h2>/);
        assert.match(page, /<code>rating-change<\/code>/);
        assert.match(page, /Fired when the rating changes/);
    });

    it('renders Slots, CSS Parts and CSS Custom Properties', () => {
        assert.match(page, /<h2 id="[^"]+">Slots<\/h2>/);
        assert.match(page, /\(default\)/);
        assert.match(page, /<h2 id="[^"]+">CSS Parts<\/h2>/);
        assert.match(page, /<code>star<\/code>/);
        assert.match(page, /<h2 id="[^"]+">CSS Custom Properties<\/h2>/);
        assert.match(page, /<code>--rating-color<\/code>/);
    });

    it('falls back to the manifest description when there is no TSDoc summary', () => {
        assert.match(page, /rating widget/i);
    });

    it('keeps @slot/@csspart/@cssprop/@fires text out of the summary section', () => {
        const description = page.match(/<section id="description">([\s\S]*?)<\/section>/)?.[1] ?? '';
        assert.ok(description.length > 0, 'description section should exist');
        assert.doesNotMatch(description, /Default slot for the label/);
        assert.doesNotMatch(description, /The individual star element/);
        assert.doesNotMatch(description, /Color of the active stars/);
        assert.doesNotMatch(description, /Fired when the rating changes/);
    });

    it('gives the preview section a heading', () => {
        assert.match(page, /<section id="preview">\s*<h2>Preview<\/h2>/);
    });
});

describe('DocGen.generate (description rendering)', () => {
    let page: string;

    before(async () => {
        const docGen = new DocGen('my-circle');
        page = await docGen.generate('./examples/my-circle/my-circle.ts');
    });

    it('converts backtick code spans in manifest descriptions to <code>', () => {
        assert.match(page, /<code>detail: \{ size \}<\/code>/);
        assert.doesNotMatch(page, /`detail: \{ size \}`/);
    });
});
