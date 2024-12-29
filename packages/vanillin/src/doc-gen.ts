import { TSDocParser, type ParserContext, type DocComment, TSDocConfiguration, TSDocTagDefinition, TSDocTagSyntaxKind } from '@microsoft/tsdoc';
import * as path from 'path';
import * as fs from 'fs';
import { Formatter } from './formatter';
export class DocGen {

    parseDoc(doc: string): ParserContext {
        const inputFilename: string = path.resolve(doc);
        const inputBuffer: string = fs.readFileSync(inputFilename).toString();
        
        const customConfiguration: TSDocConfiguration = new TSDocConfiguration();
        
        const customBlockDefinition: TSDocTagDefinition = new TSDocTagDefinition({
            tagName: '@demo',
            syntaxKind: TSDocTagSyntaxKind.BlockTag
        });

        customConfiguration.addTagDefinitions([
            customBlockDefinition
        ]);

        const tsdocParser: TSDocParser = new TSDocParser(customConfiguration);
        const parserContext: ParserContext = tsdocParser.parseString(inputBuffer);
        return parserContext;
    }

    render (context: ParserContext): string { 
        const docComment: DocComment = context.docComment;
        const result = Formatter.renderDocNodes(docComment.getChildNodes());
        return result;
    }

    renderDocs(context: ParserContext) {
        const docComment: DocComment = context.docComment;
        const result = Formatter.renderDocNodes(docComment.customBlocks);
        return result;
    }
}