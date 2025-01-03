import { describe, it, before } from "node:test";
import assert from "node:assert";
import { DocGen } from '../src/doc-gen';
import { ParserContext } from "@microsoft/tsdoc";

describe('DocGen', () => {
    let docGen: DocGen;
    let context: ParserContext;

    before(async () => {
        docGen = new DocGen('my-circle');
        context = await docGen.parseDoc('./test/fixtures/my-circle.ts');
    });

    it('should parse a typescript file and return a ParserContext', () => {
        assert.ok(context, 'ParserContext should be returned');
    });

    it('returns the demo tag', () => {
        assert.equal(context.docComment.customBlocks.length, 1);
    });

    it('rendered result contains tag', () => {
        const doc = docGen.renderDocs(context);
        assert.match(doc, /my-circle/);
    });

    describe('getters', () => {

        it('returns correct path for default tag', () => {
            assert.equal(docGen.src, './dist/my-circle.js');
        });

        it('returns correct path for custom tag', () => {
            const customDocGen = new DocGen('custom-element');
            assert.equal(customDocGen.src, './dist/custom-element.js');
        });
        it('returns formatted title for default tag', () => {
            assert.equal(docGen.title, '<my-circle> Component Demo');
        });

        it('returns formatted title for custom tag', () => {
            const customDocGen = new DocGen('custom-element');
            assert.equal(customDocGen.title, '<custom-element> Component Demo');
        });
    });
});
