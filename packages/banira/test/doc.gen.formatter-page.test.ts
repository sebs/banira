import { describe, it, before } from "node:test";
import assert from "node:assert";
import { DocGen } from '../src/doc-gen';
import { ParserContext } from "@microsoft/tsdoc";
import { FormatterDocPage } from '../src/formatter/doc-page';

describe('DocGen Formatter', () => {
    let docGen: DocGen;
    let parsed: ParserContext;
    let formatter: FormatterDocPage;

    before(async () => {
        docGen = new DocGen();
        parsed = await docGen.parseDoc('./test/fixtures/my-circle.ts');
        formatter = new FormatterDocPage(parsed);
    })
    it('should parse a typescript file and return a ParserContext', async () => {
        assert.ok(parsed, 'ParserContext should be returned');
    });

    it('should create a doc page', async () => {
        const result = formatter.createDocPage();
        assert.ok(result, 'Doc page should be created');
    });

    it('contains the demo tag', async () => {
        const result = formatter.createDocPage();
        assert.match(result, /<my-circle><\/my-circle>/);
    });
});