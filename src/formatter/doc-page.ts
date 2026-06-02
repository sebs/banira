import { DocBlock, DocCodeSpan, DocFencedCode, DocNode, DocParamCollection, DocPlainText, DocSection, ParserContext, ParserMessage } from "@microsoft/tsdoc";
import type { CustomElementDeclaration } from "../manifest.js";

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
    private declaration: CustomElementDeclaration | undefined;

    /**
     * @param context - Parsed TSDoc for the component (summary, `@demo` blocks).
     * @param declaration - Optional Custom Elements Manifest declaration; when
     *   present its attributes, properties, events, slots, CSS parts and CSS
     *   custom properties are rendered as an API reference.
     */
    constructor(context: ParserContext, declaration?: CustomElementDeclaration) {
        this.context = context;
        this.declaration = declaration;
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
     * Renders the component summary section as HTML paragraphs. Falls back to
     * the manifest description when the source has no TSDoc summary.
     */
    private renderSummary(): string {
        const html = this.renderNode(this.summary).trim();
        if (html) return `<section id="description">${html}</section>`;
        const description = this.declaration?.description;
        return description ? `<section id="description"><p>${escapeHtml(description)}</p></section>` : '';
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

    /** Renders a titled table; returns '' when there are no rows. */
    private renderTable(id: string, title: string, headers: string[], rows: string[][]): string {
        if (rows.length === 0) return '';
        const head = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
        const body = rows
            .map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`)
            .join('\n            ');
        return `<section id="${id}">
        <h2>${escapeHtml(title)}</h2>
        <table>
            <thead><tr>${head}</tr></thead>
            <tbody>
            ${body}
            </tbody>
        </table>
        </section>`;
    }

    private code(value: string | undefined): string {
        return value ? `<code>${escapeHtml(value)}</code>` : '';
    }

    /** Attributes table from the manifest. */
    private renderAttributes(): string {
        const rows = (this.declaration?.attributes ?? []).map(a => [
            this.code(a.name),
            this.code(a.type?.text),
            this.code(a.default),
            escapeHtml(a.description ?? ''),
        ]);
        return this.renderTable('attributes', 'Attributes', ['Attribute', 'Type', 'Default', 'Description'], rows);
    }

    /** Properties (public fields/accessors) table from the manifest. */
    private renderProperties(): string {
        const rows = (this.declaration?.members ?? [])
            .filter(m => m.kind === 'field')
            .map(m => [this.code(m.name), this.code(m.type?.text), this.code(m.default), escapeHtml(m.description ?? '')]);
        return this.renderTable('properties', 'Properties', ['Property', 'Type', 'Default', 'Description'], rows);
    }

    /** Public methods table from the manifest. */
    private renderMethods(): string {
        const rows = (this.declaration?.members ?? [])
            .filter(m => m.kind === 'method')
            .map(m => [this.code(m.name), this.code(m.return?.type?.text), escapeHtml(m.description ?? '')]);
        return this.renderTable('methods', 'Methods', ['Method', 'Returns', 'Description'], rows);
    }

    /** Events table from the manifest. */
    private renderEvents(): string {
        const rows = (this.declaration?.events ?? []).map(e => [
            this.code(e.name),
            this.code(e.type?.text),
            escapeHtml(e.description ?? ''),
        ]);
        return this.renderTable('events', 'Events', ['Event', 'Type', 'Description'], rows);
    }

    /** Slots table from the manifest (the default slot is shown as "(default)"). */
    private renderSlots(): string {
        const rows = (this.declaration?.slots ?? []).map(s => [
            this.code(s.name || '(default)'),
            escapeHtml(s.description ?? ''),
        ]);
        return this.renderTable('slots', 'Slots', ['Slot', 'Description'], rows);
    }

    /** CSS shadow parts table from the manifest. */
    private renderCssParts(): string {
        const rows = (this.declaration?.cssParts ?? []).map(p => [this.code(p.name), escapeHtml(p.description ?? '')]);
        return this.renderTable('css-parts', 'CSS Parts', ['Part', 'Description'], rows);
    }

    /** CSS custom properties table from the manifest. */
    private renderCssProperties(): string {
        const rows = (this.declaration?.cssProperties ?? []).map(p => [
            this.code(p.name),
            this.code(p.default),
            escapeHtml(p.description ?? ''),
        ]);
        return this.renderTable('css-properties', 'CSS Custom Properties', ['Property', 'Default', 'Description'], rows);
    }

    /**
     * Renders the `@param` documentation as a definition list. Used as a
     * fallback "Attributes" section only when no manifest declaration is
     * available (the manifest models attributes precisely).
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

    /** The API reference sections, sourced from the manifest declaration. */
    private renderApi(): string {
        if (!this.declaration) return this.renderParams();
        return [
            this.renderAttributes(),
            this.renderProperties(),
            this.renderMethods(),
            this.renderEvents(),
            this.renderSlots(),
            this.renderCssParts(),
            this.renderCssProperties(),
        ].filter(Boolean).join('\n        ');
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
        ${this.renderApi()}
    </main>
    <footer class="container">
      <small>Built with banira</small>
    </footer>
</body>
</html>`
    }

}
