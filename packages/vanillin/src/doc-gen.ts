import { TSDocParser, type ParserContext, type DocComment, TSDocConfiguration, TSDocTagDefinition, TSDocTagSyntaxKind } from '@microsoft/tsdoc';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { Formatter } from './formatter';

/**
 * A class for parsing and rendering TSDoc documentation comments.
 * Provides functionality to parse TypeScript source files and extract their documentation,
 * as well as render the documentation in a formatted way.
 */
export class DocGen {

    public customConfiguration = new TSDocConfiguration();
    
    public tsdocParser: TSDocParser;

    /**
     * TSDoc tag definition for demo blocks.
     * This custom block tag allows marking code sections as demos in the documentation.
     */
    public static CUSTOM_BLOCK_DEFINITION_DEMO = new TSDocTagDefinition({
        tagName: '@demo',
        syntaxKind: TSDocTagSyntaxKind.BlockTag
    });

    constructor() {
        this.customConfiguration.addTagDefinitions([
            DocGen.CUSTOM_BLOCK_DEFINITION_DEMO
        ]);
        this.tsdocParser = new TSDocParser(this.customConfiguration);
    }

    /**
     * Parses a TypeScript source file to extract its documentation.
     * 
     * @param doc - The path to the TypeScript source file to parse
     * @returns A Promise that resolves to a ParserContext containing the parsed documentation
     */
    async parseDoc(doc: string): Promise<ParserContext> {
        const inputFilename: string = path.resolve(doc);
        const inputBuffer: string = await readFile(inputFilename, 'utf-8');
        return this.parseString(inputBuffer);
    }

    /**
     * Parses a TypeScript source file to extract its documentation.
     * 
     * @param sourceCode - The path to the TypeScript source file to parse
     * @returns A Promise that resolves to a ParserContext containing the parsed documentation
     */
    private parseString(sourceCode: string): ParserContext {
        const parserContext: ParserContext = this.tsdocParser.parseString(sourceCode);
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
     * @throws Error if the context or docComment is undefined
     */
    renderDocs(context: ParserContext): string {
        if (!context || !context.docComment) {
            throw new Error('Invalid parser context: docComment is undefined');
        }
        const docComment: DocComment = context.docComment;
        const result = Formatter.renderDocNodes(docComment.customBlocks);
        return result;
    }
}