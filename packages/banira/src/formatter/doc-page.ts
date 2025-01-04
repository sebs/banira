import { DocBlock, DocParamCollection, DocSection, ParserContext, ParserMessage } from "@microsoft/tsdoc";

export class FormatterDocPage { 
    private context: ParserContext;

    constructor(context: ParserContext) { 
        this.context = context;
    }

    get custom(): readonly DocBlock[] {
        return this.context.docComment.customBlocks;
    }

    get logs(): readonly ParserMessage[] {
        return this.context.log.messages;
    }

    get params(): DocParamCollection {
        return this.context.docComment.params
    }

    get summary(): DocSection {
        return this.context.docComment.summarySection
    }

    createDocPage(tagName: string, src: string, title: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script type="module" src="${src}"></script>
    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
    >
</head>
<body>
    <header>
        <h1>${title}</h1>
    </header>
    <main>
        <${tagName}></${tagName}>
    </main>
</body>
</html>`
    }

}
