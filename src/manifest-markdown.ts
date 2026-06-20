import { eventTypeText } from './manifest.js';
import type {
    Attribute,
    CemEvent,
    ClassField,
    ClassMethod,
    CssCustomProperty,
    CustomElementDeclaration,
    NamedDoc,
    Package,
    Parameter,
} from './manifest.js';

export interface MarkdownOptions {
    /** Optional document title rendered as a top-level `#` heading. */
    title?: string;
    /** Heading level for each component (1-5, default 2 → `##`). */
    headingLevel?: number;
}

/** Escapes a value for use inside a Markdown table cell. */
function cell(value: string | undefined): string {
    if (!value) return '';
    return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function code(value: string | undefined): string {
    const text = cell(value);
    return text ? `\`${text}\`` : '';
}

/** Appends a `(deprecated[: note])` marker to a description cell. */
function withDeprecated(description: string | undefined, deprecated: boolean | string | undefined): string {
    if (deprecated === undefined) return cell(description);
    const note = typeof deprecated === 'string' ? `: ${deprecated}` : '';
    const marker = `**Deprecated${note}**`;
    const desc = cell(description);
    return desc ? `${marker} ${desc}` : marker;
}

function table(headers: string[], rows: string[][]): string {
    if (rows.length === 0) return '';
    const head = `| ${headers.join(' | ')} |`;
    const sep = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
    return `${head}\n${sep}\n${body}`;
}

function section(title: string, content: string): string {
    return content ? `### ${title}\n\n${content}` : '';
}

function signature(name: string, parameters: Parameter[] = []): string {
    const params = parameters
        .map((p) => `${p.rest ? '...' : ''}${p.name}${p.optional && !p.rest ? '?' : ''}`)
        .join(', ');
    return `${name}(${params})`;
}

function attributesTable(attributes: Attribute[]): string {
    const rows = attributes.map((a) => [
        code(a.name),
        code(a.type?.text),
        code(a.default),
        withDeprecated(a.description, a.deprecated),
    ]);
    return section('Attributes', table(['Attribute', 'Type', 'Default', 'Description'], rows));
}

function propertiesTable(fields: ClassField[]): string {
    const rows = fields.map((f) => [
        code(f.readonly ? `${f.name} (readonly)` : f.name),
        code(f.type?.text),
        code(f.default),
        withDeprecated(f.description, f.deprecated),
    ]);
    return section('Properties', table(['Property', 'Type', 'Default', 'Description'], rows));
}

function methodsTable(methods: ClassMethod[]): string {
    const rows = methods.map((m) => {
        const params = (m.parameters ?? [])
            .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type?.text ?? 'unknown'}`)
            .join(', ');
        return [
            code(signature(m.name, m.parameters)),
            cell(params),
            code(m.return?.type?.text),
            withDeprecated(m.description, m.deprecated),
        ];
    });
    return section('Methods', table(['Method', 'Parameters', 'Returns', 'Description'], rows));
}

function eventsTable(events: CemEvent[]): string {
    const rows = events.map((e) => [code(e.name), code(eventTypeText(e)), withDeprecated(e.description, e.deprecated)]);
    return section('Events', table(['Event', 'Type', 'Description'], rows));
}

function namedTable(title: string, label: string, items: NamedDoc[]): string {
    const rows = items.map((i) => [code(i.name || '(default)'), cell(i.description)]);
    return section(title, table([label, 'Description'], rows));
}

function cssPropertiesTable(props: CssCustomProperty[]): string {
    const rows = props.map((p) => [code(p.name), code(p.default), cell(p.description)]);
    return section('CSS Custom Properties', table(['Property', 'Default', 'Description'], rows));
}

function declarationToMarkdown(decl: CustomElementDeclaration, headingPrefix: string): string {
    const title = decl.tagName ? `\`<${decl.tagName}>\`` : decl.name;
    const parts: string[] = [`${headingPrefix} ${title}`];

    if (decl.deprecated !== undefined) {
        const note = typeof decl.deprecated === 'string' ? `: ${decl.deprecated}` : '';
        parts.push(`> **Deprecated${note}**`);
    }
    if (decl.description) parts.push(decl.description);
    else if (decl.summary) parts.push(decl.summary);

    const fields = (decl.members ?? []).filter((m): m is ClassField => m.kind === 'field');
    const methods = (decl.members ?? []).filter((m): m is ClassMethod => m.kind === 'method');

    for (const block of [
        attributesTable(decl.attributes ?? []),
        propertiesTable(fields),
        methodsTable(methods),
        eventsTable(decl.events ?? []),
        namedTable('Slots', 'Slot', decl.slots ?? []),
        namedTable('CSS Parts', 'Part', decl.cssParts ?? []),
        cssPropertiesTable(decl.cssProperties ?? []),
    ]) {
        if (block) parts.push(block);
    }

    return parts.join('\n\n');
}

/**
 * Renders a Custom Elements Manifest as Markdown API documentation — one section
 * per custom element with tables for attributes, properties, methods, events,
 * slots, CSS parts and CSS custom properties. Suitable for a README or docs site.
 */
export function manifestToMarkdown(pkg: Package, options: MarkdownOptions = {}): string {
    const level = Math.min(Math.max(options.headingLevel ?? 2, 1), 5);
    const prefix = '#'.repeat(level);
    const blocks: string[] = [];
    if (options.title) blocks.push(`# ${options.title}`);

    const declarations = pkg.modules.flatMap((m) => m.declarations);
    for (const decl of declarations) {
        blocks.push(declarationToMarkdown(decl, prefix));
    }

    return blocks.join('\n\n') + '\n';
}
