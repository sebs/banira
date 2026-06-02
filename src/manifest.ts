import {
    createProgram,
    forEachChild,
    getCombinedModifierFlags,
    getJSDocTags,
    isCallExpression,
    isClassDeclaration,
    isGetAccessorDeclaration,
    isIdentifier,
    isMethodDeclaration,
    isNewExpression,
    isPrivateIdentifier,
    isPropertyAccessExpression,
    isPropertyDeclaration,
    isSetAccessorDeclaration,
    isStringLiteralLike,
    displayPartsToString,
    getTextOfJSDocComment,
    ModifierFlags,
    SymbolFlags,
    type ClassDeclaration,
    type CompilerOptions,
    type Identifier,
    type Node,
    type Program,
    type SourceFile,
    type TypeChecker,
} from 'typescript';
import { Compiler } from './compiler.js';

/**
 * A minimal, spec-shaped subset of the Custom Elements Manifest
 * (https://github.com/webcomponents/custom-elements-manifest), schemaVersion
 * 2.1.0. banira emits the parts that apply to vanilla custom elements.
 */
export interface Package {
    schemaVersion: string;
    readme?: string;
    modules: Module[];
}

export interface Module {
    kind: 'javascript-module';
    path: string;
    declarations: CustomElementDeclaration[];
    exports: ModuleExport[];
}

export interface ModuleExport {
    kind: 'js' | 'custom-element-definition';
    name: string;
    declaration: { name: string; module?: string };
}

export interface CustomElementDeclaration {
    kind: 'class';
    name: string;
    customElement: true;
    tagName?: string;
    description?: string;
    summary?: string;
    superclass?: { name: string };
    members?: ClassMember[];
    attributes?: Attribute[];
    events?: CemEvent[];
    slots?: NamedDoc[];
    cssParts?: NamedDoc[];
    cssProperties?: CssCustomProperty[];
}

export interface Attribute {
    name: string;
    description?: string;
    type?: { text: string };
    default?: string;
    fieldName?: string;
}

export interface ClassField {
    kind: 'field';
    name: string;
    description?: string;
    privacy: 'public' | 'private' | 'protected';
    static?: boolean;
    type?: { text: string };
    default?: string;
}

export interface ClassMethod {
    kind: 'method';
    name: string;
    description?: string;
    privacy: 'public' | 'private' | 'protected';
    static?: boolean;
    return?: { type?: { text: string } };
}

export type ClassMember = ClassField | ClassMethod;

export interface CemEvent {
    name: string;
    description?: string;
    type?: { text: string };
}

export interface NamedDoc {
    name: string;
    description?: string;
}

export interface CssCustomProperty {
    name: string;
    description?: string;
    default?: string;
}

/** Standard custom-element lifecycle members, excluded from the public API surface. */
const LIFECYCLE_MEMBERS = new Set([
    'connectedCallback',
    'disconnectedCallback',
    'adoptedCallback',
    'attributeChangedCallback',
    'formAssociatedCallback',
    'formDisabledCallback',
    'formResetCallback',
    'formStateRestoreCallback',
    'observedAttributes',
]);

/** A valid custom-element tag name: lowercase, starts with a letter, contains a hyphen. */
function isCustomElementName(name: string): boolean {
    return /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/.test(name);
}

/** Splits `name - description` (or `name description`) used by jsdoc tags like @slot/@csspart. */
function parseNameDescription(raw: string): NamedDoc {
    const text = raw.trim();
    // `@slot - description` (leading dash, no name) denotes the unnamed/default entry.
    const leadingDash = text.match(/^-\s+([\s\S]*)$/);
    if (leadingDash) {
        const desc = leadingDash[1]!.trim();
        return desc ? { name: '', description: desc } : { name: '' };
    }
    const dash = text.match(/^(\S+)\s*-\s*([\s\S]*)$/);
    if (dash) {
        const desc = dash[2]!.trim();
        return desc ? { name: dash[1]!, description: desc } : { name: dash[1]! };
    }
    const space = text.match(/^(\S+)\s+([\s\S]*)$/);
    if (space) {
        const desc = space[2]!.trim();
        return desc ? { name: space[1]!, description: desc } : { name: space[1]! };
    }
    return { name: text };
}

/**
 * Builds a Custom Elements Manifest by statically analysing vanilla custom
 * elements (classes extending `HTMLElement` registered with
 * `customElements.define`). Attributes come from `observedAttributes`,
 * properties/methods from public class members, events from `new CustomEvent(...)`,
 * and slots / CSS parts / CSS custom properties from class jsdoc tags
 * (`@slot`, `@csspart`, `@cssprop`).
 */
export class ManifestGenerator {
    public readonly fileNames: string[];
    private program: Program;
    private checker: TypeChecker;

    constructor(fileNames: string[], options: CompilerOptions = Compiler.DEFAULT_COMPILER_OPTIONS) {
        this.fileNames = fileNames;
        this.program = createProgram(fileNames, options);
        this.checker = this.program.getTypeChecker();
    }

    /** Produces the full manifest for all input files. */
    generate(): Package {
        const inputs = new Set(this.fileNames.map((f) => this.program.getSourceFile(f)).filter(Boolean) as SourceFile[]);
        const modules: Module[] = [];
        for (const sourceFile of inputs) {
            const module = this.analyzeModule(sourceFile);
            if (module.declarations.length > 0) modules.push(module);
        }
        return { schemaVersion: '2.1.0', modules };
    }

    private analyzeModule(sourceFile: SourceFile): Module {
        const definitions = this.collectDefinitions(sourceFile);
        const declarations: CustomElementDeclaration[] = [];
        const exports: ModuleExport[] = [];

        forEachChild(sourceFile, (node) => {
            if (
                isClassDeclaration(node) &&
                node.name &&
                !this.isAbstract(node) &&
                this.extendsHTMLElement(node)
            ) {
                const decl = this.analyzeClass(node, definitions);
                declarations.push(decl);
                exports.push({ kind: 'js', name: decl.name, declaration: { name: decl.name } });
                if (decl.tagName) {
                    exports.push({
                        kind: 'custom-element-definition',
                        name: decl.tagName,
                        declaration: { name: decl.name },
                    });
                }
            }
        });

        return { kind: 'javascript-module', path: sourceFile.fileName, declarations, exports };
    }

    /**
     * Maps class name -> tag name from registration calls. Recognizes both
     * `customElements.define('x', Ctor)` and registration helpers such as
     * `defineOnce('x', Ctor)` — for a helper call the tag must be a valid custom
     * element name and `Ctor` must resolve to a (transitive) custom-element class,
     * which avoids misreading ordinary `fn('label', SomeClass)` calls.
     */
    private collectDefinitions(sourceFile: SourceFile): Map<string, string> {
        const map = new Map<string, string>();
        const visit = (node: Node): void => {
            if (isCallExpression(node) && node.arguments.length >= 2) {
                const [tag, ctor] = node.arguments;
                if (tag && isStringLiteralLike(tag) && ctor && isIdentifier(ctor)) {
                    const callee = node.expression;
                    const isDefineCall = isPropertyAccessExpression(callee) && callee.name.text === 'define';
                    if (isDefineCall) {
                        map.set(ctor.text, tag.text);
                    } else if (isCustomElementName(tag.text) && this.identifierIsCustomElementClass(ctor)) {
                        map.set(ctor.text, tag.text);
                    }
                }
            }
            forEachChild(node, visit);
        };
        visit(sourceFile);
        return map;
    }

    /** True if the class extends `HTMLElement` directly or through a base class in the program. */
    private extendsHTMLElement(node: ClassDeclaration, seen: Set<ClassDeclaration> = new Set()): boolean {
        if (seen.has(node)) return false;
        seen.add(node);
        const heritage = node.heritageClauses?.flatMap((c) => c.types) ?? [];
        for (const type of heritage) {
            if (type.expression.getText().endsWith('HTMLElement')) return true;
            const base = this.resolveClassDeclaration(type.expression);
            if (base && this.extendsHTMLElement(base, seen)) return true;
        }
        return false;
    }

    /** Resolves a class reference (identifier, possibly imported) to its ClassDeclaration. */
    private resolveClassDeclaration(expr: Node): ClassDeclaration | undefined {
        let symbol = this.checker.getSymbolAtLocation(expr);
        if (symbol && symbol.flags & SymbolFlags.Alias) {
            symbol = this.checker.getAliasedSymbol(symbol);
        }
        return symbol?.declarations?.find((d): d is ClassDeclaration => isClassDeclaration(d));
    }

    /** Whether an identifier resolves to a class that is (transitively) a custom element. */
    private identifierIsCustomElementClass(id: Identifier): boolean {
        const decl = this.resolveClassDeclaration(id);
        return decl ? this.extendsHTMLElement(decl) : false;
    }

    private isAbstract(node: ClassDeclaration): boolean {
        return (getCombinedModifierFlags(node) & ModifierFlags.Abstract) !== 0;
    }

    private analyzeClass(node: ClassDeclaration, definitions: Map<string, string>): CustomElementDeclaration {
        const name = node.name!.text;
        const decl: CustomElementDeclaration = { kind: 'class', name, customElement: true };

        const tagName = definitions.get(name);
        if (tagName) decl.tagName = tagName;

        const description = this.descriptionOf(node);
        if (description) decl.description = description;

        decl.superclass = { name: 'HTMLElement' };

        // Class-level jsdoc tags: @slot, @csspart, @cssprop/@cssproperty, @fires/@event, @summary.
        const slots: NamedDoc[] = [];
        const cssParts: NamedDoc[] = [];
        const cssProperties: CssCustomProperty[] = [];
        const taggedEvents: CemEvent[] = [];
        for (const tag of getJSDocTags(node)) {
            const tagName = tag.tagName.text.toLowerCase();
            const comment = getTextOfJSDocComment(tag.comment) ?? '';
            if (tagName === 'slot') slots.push(parseNameDescription(comment));
            else if (tagName === 'csspart') cssParts.push(parseNameDescription(comment));
            else if (tagName === 'cssprop' || tagName === 'cssproperty') cssProperties.push(parseNameDescription(comment));
            else if (tagName === 'fires' || tagName === 'event') taggedEvents.push(parseNameDescription(comment));
            else if (tagName === 'summary') {
                const summary = comment.trim();
                if (summary) decl.summary = summary;
            }
        }

        const members = this.collectMembers(node);
        const attributes = this.collectAttributes(node, members);
        const events = this.mergeEvents(this.collectDispatchedEvents(node), taggedEvents);

        if (members.length) decl.members = members;
        if (attributes.length) decl.attributes = attributes;
        if (events.length) decl.events = events;
        if (slots.length) decl.slots = slots;
        if (cssParts.length) decl.cssParts = cssParts;
        if (cssProperties.length) decl.cssProperties = cssProperties;

        return decl;
    }

    /** Public fields, accessors (as fields), and public non-lifecycle methods. */
    private collectMembers(node: ClassDeclaration): ClassMember[] {
        const fields = new Map<string, ClassField>();
        const methods: ClassMethod[] = [];

        for (const member of node.members) {
            const memberName = member.name && 'text' in member.name ? (member.name as { text: string }).text : undefined;
            if (!memberName) continue;
            const privacy = this.privacyOf(member);
            const isStatic = (getCombinedModifierFlags(member) & ModifierFlags.Static) !== 0;

            if (isPropertyDeclaration(member) || isGetAccessorDeclaration(member) || isSetAccessorDeclaration(member)) {
                if (privacy !== 'public' || isStatic) continue;
                const existing = fields.get(memberName);
                const field: ClassField = existing ?? { kind: 'field', name: memberName, privacy };
                const description = this.descriptionOf(member);
                if (description && !field.description) field.description = description;
                const typeText = this.typeTextOf(member);
                if (typeText && !field.type) field.type = { text: typeText };
                if (isPropertyDeclaration(member) && member.initializer && field.default === undefined) {
                    field.default = member.initializer.getText();
                }
                fields.set(memberName, field);
            } else if (isMethodDeclaration(member)) {
                if (privacy !== 'public' || LIFECYCLE_MEMBERS.has(memberName)) continue;
                const method: ClassMethod = { kind: 'method', name: memberName, privacy };
                if (isStatic) method.static = true;
                const description = this.descriptionOf(member);
                if (description) method.description = description;
                const ret = this.typeTextOf(member);
                if (ret) method.return = { type: { text: ret } };
                methods.push(method);
            }
        }

        // Backfill accessor defaults/descriptions from a matching private backing field (_name / #name).
        for (const field of fields.values()) {
            if (field.default !== undefined && field.description) continue;
            for (const member of node.members) {
                if (!isPropertyDeclaration(member)) continue;
                const backingName = member.name && 'text' in member.name ? (member.name as { text: string }).text : undefined;
                if (backingName !== `_${field.name}` && backingName !== `#${field.name}`) continue;
                if (field.default === undefined && member.initializer) field.default = member.initializer.getText();
                if (!field.description) {
                    const d = this.descriptionOf(member);
                    if (d) field.description = d;
                }
            }
        }

        return [...fields.values(), ...methods];
    }

    /** Attribute names from `static get observedAttributes()`, linked to matching properties. */
    private collectAttributes(node: ClassDeclaration, members: ClassMember[]): Attribute[] {
        const observed = node.members.find(
            (m) => isGetAccessorDeclaration(m) && m.name.getText() === 'observedAttributes'
        );
        if (!observed || !isGetAccessorDeclaration(observed) || !observed.body) return [];

        const names: string[] = [];
        const visit = (n: Node): void => {
            if (isStringLiteralLike(n)) names.push(n.text);
            else forEachChild(n, visit);
        };
        for (const statement of observed.body.statements) visit(statement);

        return names.map((attrName) => {
            const attr: Attribute = { name: attrName };
            const field = members.find((m): m is ClassField => m.kind === 'field' && m.name === attrName);
            if (field) {
                attr.fieldName = field.name;
                if (field.type) attr.type = field.type;
                if (field.default !== undefined) attr.default = field.default;
                if (field.description) attr.description = field.description;
            }
            return attr;
        });
    }

    /** Events from `new CustomEvent('name')` / `new Event('name')` anywhere in the class. */
    private collectDispatchedEvents(node: ClassDeclaration): CemEvent[] {
        const events = new Map<string, CemEvent>();
        const visit = (n: Node): void => {
            if (isNewExpression(n)) {
                const ctor = n.expression.getText();
                if ((ctor === 'CustomEvent' || ctor === 'Event') && n.arguments && n.arguments.length > 0) {
                    const first = n.arguments[0];
                    if (first && isStringLiteralLike(first)) {
                        events.set(first.text, { name: first.text, type: { text: ctor } });
                    }
                }
            }
            forEachChild(n, visit);
        };
        visit(node);
        return [...events.values()];
    }

    private mergeEvents(detected: CemEvent[], tagged: CemEvent[]): CemEvent[] {
        const byName = new Map<string, CemEvent>();
        for (const e of detected) byName.set(e.name, e);
        for (const e of tagged) {
            const existing = byName.get(e.name);
            if (existing) {
                if (!existing.description && e.description) existing.description = e.description;
            } else {
                byName.set(e.name, e);
            }
        }
        return [...byName.values()];
    }

    private privacyOf(node: Node): 'public' | 'private' | 'protected' {
        const flags = getCombinedModifierFlags(node as Parameters<typeof getCombinedModifierFlags>[0]);
        if (flags & ModifierFlags.Private) return 'private';
        if (flags & ModifierFlags.Protected) return 'protected';
        const named = node as { name?: Node };
        if (named.name && isPrivateIdentifier(named.name)) return 'private';
        return 'public';
    }

    private descriptionOf(node: Node): string | undefined {
        const symbol = this.checker.getSymbolAtLocation((node as { name?: Node }).name ?? node);
        if (!symbol) return undefined;
        const doc = displayPartsToString(symbol.getDocumentationComment(this.checker)).trim();
        return doc || undefined;
    }

    private typeTextOf(node: Node): string | undefined {
        try {
            const type = this.checker.getTypeAtLocation(node);
            const text = this.checker.typeToString(type);
            return text && text !== 'any' && text !== 'error' ? text : undefined;
        } catch {
            return undefined;
        }
    }
}
