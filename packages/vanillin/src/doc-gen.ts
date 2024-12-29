import { TSDocParser, type ParserContext, type DocComment, TSDocConfiguration, TSDocTagDefinition, TSDocTagSyntaxKind } from '@microsoft/tsdoc';
import * as path from 'path';
import * as fs from 'fs';
import { Formatter } from './formatter';

/**
 * A class for parsing and rendering TSDoc documentation comments.
 * Provides functionality to parse TypeScript source files and extract their documentation,
 * as well as render the documentation in a formatted way.
 */
export class DocGen {

    /**
     * TSDoc tag definition for demo blocks.
     * This custom block tag allows marking code sections as demos in the documentation.
     */
    public static CUSTOM_BLOCK_DEFINITION_DEMO = new TSDocTagDefinition({
        tagName: '@demo',
        syntaxKind: TSDocTagSyntaxKind.BlockTag
    });

    /**
     * Parses a TypeScript source file to extract its documentation.
     * 
     * @param doc - The path to the TypeScript source file to parse
     * @returns A ParserContext containing the parsed documentation
     */
    parseDoc(doc: string): ParserContext {
        const inputFilename: string = path.resolve(doc);
        const inputBuffer: string = fs.readFileSync(inputFilename).toString();
        
        const customConfiguration: TSDocConfiguration = new TSDocConfiguration();
        
        customConfiguration.addTagDefinitions([
            DocGen.CUSTOM_BLOCK_DEFINITION_DEMO
        ]);
        
        const tsdocParser: TSDocParser = new TSDocParser(customConfiguration);
        const parserContext: ParserContext = tsdocParser.parseString(inputBuffer);
        return parserContext;
    }

    /**
     * Renders all documentation nodes from a parsed documentation context.
     * 
     * @param context - The parsed documentation context to render
     * @returns A formatted string containing the rendered documentation
     */
    render(context: ParserContext): string { 
        const docComment: DocComment = context.docComment;
        const result = Formatter.renderDocNodes(docComment.getChildNodes());
        return result;
    }

    /**
     * Renders only the custom documentation blocks from a parsed documentation context.
     * This specifically focuses on rendering blocks marked with custom tags like @demo.
     * 
     * @param context - The parsed documentation context to render
     * @returns A formatted string containing only the custom documentation blocks
     */
    renderDocs(context: ParserContext) {
        const docComment: DocComment = context.docComment;
        const result = Formatter.renderDocNodes(docComment.customBlocks);
        return result;
    }
}