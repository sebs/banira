import type { Attribute, CemEvent, ClassField, CustomElementDeclaration, Package } from './manifest.js';

/** Appends a deprecation note to a description string for editor tooltips. */
function describe(description: string | undefined, deprecated?: boolean | string): string | undefined {
    if (deprecated === undefined) return description || undefined;
    const note = typeof deprecated === 'string' ? `Deprecated: ${deprecated}` : 'Deprecated.';
    return description ? `${note}\n\n${description}` : note;
}

function customElements(pkg: Package): CustomElementDeclaration[] {
    return pkg.modules.flatMap((m) => m.declarations).filter((d) => d.tagName);
}

// --- VS Code custom data (https://github.com/microsoft/vscode-custom-data) ---

export interface VsCodeHtmlAttribute {
    name: string;
    description?: string;
}

export interface VsCodeHtmlTag {
    name: string;
    description?: string;
    attributes: VsCodeHtmlAttribute[];
    references?: { name: string; url: string }[];
}

export interface VsCodeHtmlData {
    version: 1.1;
    tags: VsCodeHtmlTag[];
}

export interface VsCodeCssData {
    version: 1.1;
    properties: { name: string; description?: string }[];
}

/** Builds a VS Code HTML custom-data document so editors autocomplete the custom elements. */
export function toVsCodeHtmlData(pkg: Package): VsCodeHtmlData {
    const tags = customElements(pkg).map((decl) => {
        const tag: VsCodeHtmlTag = {
            name: decl.tagName!,
            attributes: (decl.attributes ?? []).map((a: Attribute) => {
                const attr: VsCodeHtmlAttribute = { name: a.name };
                const d = describe(a.description, a.deprecated);
                if (d) attr.description = d;
                return attr;
            }),
        };
        const d = describe(decl.description ?? decl.summary, decl.deprecated);
        if (d) tag.description = d;
        return tag;
    });
    return { version: 1.1, tags };
}

/** Builds a VS Code CSS custom-data document from the manifest's CSS custom properties. */
export function toVsCodeCssData(pkg: Package): VsCodeCssData {
    const seen = new Map<string, string | undefined>();
    for (const decl of customElements(pkg)) {
        for (const prop of decl.cssProperties ?? []) {
            if (!seen.has(prop.name)) seen.set(prop.name, prop.description);
        }
    }
    const properties = [...seen].map(([name, description]) => (description ? { name, description } : { name }));
    return { version: 1.1, properties };
}

// --- JetBrains web-types (https://github.com/JetBrains/web-types) ---

export interface WebTypesOptions {
    name: string;
    version: string;
}

export interface WebTypes {
    $schema: string;
    name: string;
    version: string;
    'description-markup': 'markdown';
    contributions: {
        html: {
            elements: WebTypesElement[];
        };
    };
}

interface WebTypesSymbol {
    name: string;
    description?: string;
    deprecated?: boolean;
}

interface WebTypesElement extends WebTypesSymbol {
    attributes?: WebTypesSymbol[];
    js?: {
        properties?: WebTypesSymbol[];
        events?: WebTypesSymbol[];
    };
}

function symbol(name: string, description?: string, deprecated?: boolean | string): WebTypesSymbol {
    const s: WebTypesSymbol = { name };
    const d = describe(description, deprecated);
    if (d) s.description = d;
    if (deprecated !== undefined) s.deprecated = true;
    return s;
}

/** Builds a JetBrains web-types document so WebStorm/IntelliJ autocomplete the custom elements. */
export function toWebTypes(pkg: Package, options: WebTypesOptions): WebTypes {
    const elements = customElements(pkg).map((decl): WebTypesElement => {
        const element: WebTypesElement = symbol(decl.tagName!, decl.description ?? decl.summary, decl.deprecated);
        const attributes = (decl.attributes ?? []).map((a) => symbol(a.name, a.description, a.deprecated));
        if (attributes.length) element.attributes = attributes;

        const properties = (decl.members ?? [])
            .filter((m): m is ClassField => m.kind === 'field')
            .map((f) => symbol(f.name, f.description, f.deprecated));
        const events = (decl.events ?? []).map((e: CemEvent) => symbol(e.name, e.description, e.deprecated));
        if (properties.length || events.length) {
            element.js = {};
            if (properties.length) element.js.properties = properties;
            if (events.length) element.js.events = events;
        }
        return element;
    });

    return {
        $schema: 'https://json.schemastore.org/web-types',
        name: options.name,
        version: options.version,
        'description-markup': 'markdown',
        contributions: { html: { elements } },
    };
}
