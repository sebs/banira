import { describe, it } from "node:test";
import assert from "node:assert";
import { DocGen } from '../src/doc-gen';

describe('DocGen', () => {
    it('should parse a typescript file and return a ParserContext', () => {
        const docGen = new DocGen();
        const result = docGen.parseDoc('./test/fixtures/my-circle.ts');
        assert.ok(result, 'ParserContext should be returned');
        console.log(docGen.render(result));
    });
});
