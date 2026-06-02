import { DocBlock, DocCodeSpan, DocFencedCode, DocNode, DocParamCollection, DocPlainText, DocSection, ParserContext, ParserMessage } from "@microsoft/tsdoc";

const DEMO_TAG = '@demo';

/**
 * Escapes a string for safe inclusion in HTML text/attribute content.
 */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

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

    /**
     * Renders a TSDoc node tree to HTML, handling the inline/block kinds that
     * appear in component summaries and `@demo` blocks. Unknown container kinds
     * are traversed transparently so their content is not dropped.
     */
    private renderNode(node: DocNode): string {
        switch (node.kind) {
            case 'PlainText':
                return escapeHtml((node as DocPlainText).text);
            case 'SoftBreak':
                return ' ';
            case 'CodeSpan':
                return `<code>${escapeHtml((node as DocCodeSpan).code)}</code>`;
            case 'FencedCode': {
                const fenced = node as DocFencedCode;
                return `<pre><code class="language-${escapeHtml(fenced.language)}">${escapeHtml(fenced.code)}</code></pre>`;
            }
            case 'Paragraph': {
                const inner = node.getChildNodes().map(child => this.renderNode(child)).join('').trim();
                return inner ? `<p>${inner}</p>` : '';
            }
            default:
                return node.getChildNodes().map(child => this.renderNode(child)).join('');
        }
    }

    /**
     * Collects the fenced code blocks contained in a TSDoc node tree.
     * Used to surface the markup inside a `@demo` block both as a live preview
     * and as displayed source.
     */
    private collectFencedCode(node: DocNode): DocFencedCode[] {
        if (node.kind === 'FencedCode') {
            return [node as DocFencedCode];
        }
        return node.getChildNodes().flatMap(child => this.collectFencedCode(child));
    }

    /**
     * Renders the component summary section as HTML paragraphs.
     */
    private renderSummary(): string {
        const html = this.renderNode(this.summary).trim();
        return html ? `<section id="description">${html}</section>` : '';
    }

    /**
     * Renders every `@demo` block: each fenced code example is shown live
     * (so the custom element upgrades) alongside its source.
     */
    private renderDemos(): string {
        const demoBlocks = this.custom.filter(block => block.blockTag.tagName === DEMO_TAG);
        const sections = demoBlocks.flatMap(block =>
            this.collectFencedCode(block.content).map(fenced => `
        <article class="demo">
            <div class="demo-preview">${fenced.code}</div>
            <pre><code class="language-${escapeHtml(fenced.language)}">${escapeHtml(fenced.code)}</code></pre>
        </article>`)
        );
        if (sections.length === 0) {
            return '';
        }
        return `<section id="demos">
        <h2>Demo</h2>${sections.join('')}
        </section>`;
    }

    /**
     * Renders the `@param` documentation as a definition list, if any.
     */
    private renderParams(): string {
        const blocks = this.params.blocks;
        if (blocks.length === 0) {
            return '';
        }
        const items = blocks.map(block => {
            const description = this.renderNode(block.content).trim();
            return `<dt><code>${escapeHtml(block.parameterName)}</code></dt><dd>${description}</dd>`;
        }).join('\n        ');
        return `<section id="params">
        <h2>Attributes</h2>
        <dl>
        ${items}
        </dl>
        </section>`;
    }

    createDocPage(tagName: string, src: string, title: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <script type="module" src="${src}"></script>
    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
    />
</head>
<body>
    <header class="container">
        <hgroup>
        <h1>${escapeHtml(title)}</h1>
        </hgroup>
    </header>
    <main class="container">
        ${this.renderSummary()}
        <section id="preview">
        <${tagName}></${tagName}>
        </section>
        ${this.renderDemos()}
        ${this.renderParams()}
    </main>
    <footer class="container">
      <small>Built with banira</small>
    </footer>
</body>
</html>`
    }

}
