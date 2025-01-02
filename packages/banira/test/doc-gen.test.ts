import { describe, it } from "node:test";
import assert from "node:assert";
import { DocGen } from '../src/doc-gen';

describe('DocGen', () => {
    it('should parse a typescript file and return a ParserContext', async () => {
        const docGen = new DocGen();
        const result = await docGen.parseDoc('./test/fixtures/my-circle.ts');
        assert.ok(result, 'ParserContext should be returned');
    });

    it('returns the demo tag', async () => {
        const docGen = new DocGen();
        const result = await docGen.parseDoc('./test/fixtures/my-circle.ts');
        assert.equal(result.docComment.customBlocks.length, 1);
    });

    it('rendered result contains tag', async () => {
        const docGen = new DocGen();
        const result = await docGen.parseDoc('./test/fixtures/my-circle.ts');
        const doc = docGen.renderDocs(result);
        assert.match(doc, /my-circle/);
    });
});
