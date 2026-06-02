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
        assert.match(page, /<h2>Attributes<\/h2>/);
        assert.match(page, /<code>value<\/code>/);
        assert.match(page, /<code>max<\/code>/);
    });

    it('renders a Properties section', () => {
        assert.match(page, /<h2>Properties<\/h2>/);
    });

    it('renders a Methods section with public methods', () => {
        assert.match(page, /<h2>Methods<\/h2>/);
        assert.match(page, /<code>reset<\/code>/);
    });

    it('renders an Events section from CustomEvent + @fires', () => {
        assert.match(page, /<h2>Events<\/h2>/);
        assert.match(page, /<code>rating-change<\/code>/);
        assert.match(page, /Fired when the rating changes/);
    });

    it('renders Slots, CSS Parts and CSS Custom Properties', () => {
        assert.match(page, /<h2>Slots<\/h2>/);
        assert.match(page, /\(default\)/);
        assert.match(page, /<h2>CSS Parts<\/h2>/);
        assert.match(page, /<code>star<\/code>/);
        assert.match(page, /<h2>CSS Custom Properties<\/h2>/);
        assert.match(page, /<code>--rating-color<\/code>/);
    });

    it('falls back to the manifest description when there is no TSDoc summary', () => {
        assert.match(page, /rating widget/i);
    });
});
