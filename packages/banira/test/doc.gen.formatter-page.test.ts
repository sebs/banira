import { describe, it, before } from "node:test";
import assert from "node:assert";
import { DocGen } from '../src/doc-gen.js';
import { ParserContext } from "@microsoft/tsdoc";
import { FormatterDocPage } from '../src/formatter/doc-page.js';

describe('DocGen Formatter', () => {
    let docGen: DocGen;
    let parsed: ParserContext;
    let formatter: FormatterDocPage;

    before(async () => {
        docGen = new DocGen("my-circle");
        parsed = await docGen.parseDoc('./test/fixtures/my-circle.ts');
        formatter = new FormatterDocPage(parsed);
    })

    it('customBlocks', async () => {   
        assert.equal(formatter.custom.length, 1);
    })

    it('logs', async () => {   
        assert.equal(formatter.logs.length, 0);
    })

    it('params', async () => {   
        assert.ok(formatter.params);
    })

    describe('createDocPage', () => {
        let result: string;
        before(async () => {
            result = formatter.createDocPage(docGen.tagName, docGen.src, docGen.title);
        });
    
        it('should create a doc page', async () => {
            assert.ok(result, 'Doc page should be created');
        });
        it('contains the demo tag', async () => {
            assert.match(result, /<my-circle><\/my-circle>/);
        });
        it('renders the parsed summary description', async () => {
            assert.match(result, /A custom web component that renders a circle using SVG/);
        });
        it('renders the @demo block live and as source', async () => {
            // live preview (raw, unescaped) of the demo markup
            assert.match(result, /<my-circle size="100" color="blue"><\/my-circle>/);
            // and the same markup shown as escaped source
            assert.match(result, /&lt;my-circle size=&quot;100&quot; color=&quot;blue&quot;&gt;/);
        });
    });
});