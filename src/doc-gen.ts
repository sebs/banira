import { TSDocParser, type ParserContext, TSDocConfiguration, TSDocTagDefinition, TSDocTagSyntaxKind } from '@microsoft/tsdoc';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { FormatterDocPage, DEFAULT_STYLESHEET_HREF, type Stylesheet } from './formatter/doc-page.js';
import { ManifestGenerator, type CustomElementDeclaration } from './manifest.js';

export type { Stylesheet } from './formatter/doc-page.js';

/** Options controlling the generated documentation page. */
export interface DocGenOptions {
    /** Override the component module `src` in the page. Default: `./dist/${tagName}.js`. */
    scriptSrc?: string;
    /** Page stylesheet: an external `{ href }`, inline `{ inline }` CSS, or `'none'`. Default: PicoCSS CDN. */
    stylesheet?: Stylesheet;
}

/**
 * A class for parsing and rendering TSDoc documentation comments.
 * Provides functionality to parse TypeScript source files and extract their documentation,
 * as well as render the documentation in a formatted way.
 */
export class DocGen {
    /**
     * The TSDoc configuration used for parsing and rendering documentation.
     * @link https://tsdoc.org/pages/packages/tsdoc-config/#api-usage
     */
    public customConfiguration = new TSDocConfiguration();
    /**
     * The TSDoc parser used for parsing documentation comments.
     * @link https://tsdoc.org/pages/packages/tsdoc/#invoking-the-tsdoc-parser
     */
    public tsdocParser: TSDocParser;

    /**
     * TSDoc tag definition for demo blocks.
     * This custom block tag allows marking code sections as demos in the documentation.
     * @link https://github.com/microsoft/tsdoc/blob/main/tsdoc/src/configuration/TSDocTagDefinition.ts
     */
    public static CUSTOM_BLOCK_DEFINITION_DEMO = new TSDocTagDefinition({
        tagName: '@demo',
        syntaxKind: TSDocTagSyntaxKind.BlockTag
    });

    /**
     * TSDoc tag definitions for the web-component documentation tags
     * (`@slot`, `@csspart`, `@cssprop`, `@fires`). Registering them as block
     * tags keeps their text out of the summary section — their content is
     * rendered in the API reference tables from the manifest instead.
     */
    public static WEB_COMPONENT_BLOCK_DEFINITIONS = ['@slot', '@csspart', '@cssprop', '@fires'].map(
        (tagName) => new TSDocTagDefinition({
            tagName,
            syntaxKind: TSDocTagSyntaxKind.BlockTag,
            allowMultiple: true
        })
    );

    public readonly tagName: string;

    private readonly options: DocGenOptions;

    /** The component module `src` used in the generated page (configurable via options). */
    get src(): string {
        return this.options.scriptSrc ?? `./dist/${this.tagName}.js`;
    }

    get title(): string {
        return `${this.tagName} Component Demo`;
    }

    /**
     * @param tagName - The custom element tag name to document.
     * @param options - Optional output configuration ({@link DocGenOptions}).
     */
    constructor(tagName: string, options: DocGenOptions = {}) {
        this.tagName = tagName;
        this.options = options;
        // Add custom tag definitions to detect demo blocks and to keep the
        // web-component tags (@slot/@csspart/@cssprop/@fires) out of the summary.
        this.customConfiguration.addTagDefinitions([
            DocGen.CUSTOM_BLOCK_DEFINITION_DEMO,
            ...DocGen.WEB_COMPONENT_BLOCK_DEFINITIONS
        ]);
        this.tsdocParser = new TSDocParser(this.customConfiguration);
    }

    /** The resolved page stylesheet (defaults to the PicoCSS CDN link). */
    private get stylesheet(): Stylesheet {
        return this.options.stylesheet ?? { href: DEFAULT_STYLESHEET_HREF };
    }

    fromString(sourceCode: string): ParserContext { 
        return this.tsdocParser.parseString(sourceCode);
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
     * Renders a parsed documentation context to a standalone HTML doc page.
     * The page includes the summary description, any `@demo` blocks (shown both
     * live and as source), and documented `@param` attributes.
     *
     * @param context - The parsed documentation context to render
     * @returns A complete HTML document as a string
     * @throws Error if the context or docComment is undefined
     */
    renderDocs(context: ParserContext, declaration?: CustomElementDeclaration): string {
        if (!context || !context.docComment) {
            throw new Error('Invalid parser context: docComment is undefined');
        }
        const formatter = new FormatterDocPage(context, declaration);
        return formatter.createDocPage(this.tagName, this.src, this.title, this.stylesheet);
    }

    /**
     * Builds the Custom Elements Manifest declaration for a source file,
     * preferring the one whose tag name matches this generator's tag.
     *
     * @param file - Path to the TypeScript source file
     * @returns The matching declaration, or undefined if none is found
     */
    manifestDeclaration(file: string): CustomElementDeclaration | undefined {
        const pkg = new ManifestGenerator([path.resolve(file)]).generate();
        const declarations = pkg.modules.flatMap((m) => m.declarations);
        return declarations.find((d) => d.tagName === this.tagName) ?? declarations[0];
    }

    /**
     * Produces a complete documentation page for a component: the TSDoc summary
     * and `@demo` blocks combined with a full API reference (attributes,
     * properties, events, slots, CSS parts and CSS custom properties) derived
     * from the Custom Elements Manifest.
     *
     * @param file - Path to the TypeScript source file to document
     * @param declaration - Optional pre-built manifest declaration; pass it when
     *   one is already available (e.g. when documenting a whole library) to
     *   avoid re-running the manifest analysis for this file
     * @returns A complete HTML document as a string
     */
    async generate(file: string, declaration?: CustomElementDeclaration): Promise<string> {
        const context = await this.parseDoc(file);
        return this.renderDocs(context, declaration ?? this.manifestDeclaration(file));
    }
}