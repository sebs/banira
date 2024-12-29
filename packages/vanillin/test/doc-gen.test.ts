import { describe, it } from "node:test";
import assert from "node:assert";
import { DocGen } from '../src/doc-gen';

describe('DocGen', () => {
    it('should parse a typescript file and return a ParserContext', () => {
        const docGen = new DocGen();
        const result = docGen.parseDoc('./test/fixtures/my-circle.ts');
        assert.ok(result, 'ParserContext should be returned');
    });

    it('returns the demo tag', () => {
        const docGen = new DocGen();
        const result = docGen.parseDoc('./test/fixtures/my-circle.ts');
        assert.equal(result.docComment.customBlocks.length, 1);
    });

    it('rendered result contains tag', () => {
        const docGen = new DocGen();
        const result = docGen.parseDoc('./test/fixtures/my-circle.ts');
        const doc = docGen.renderDocs(result);
        assert.match(doc, /my-circle/);
    });
});
