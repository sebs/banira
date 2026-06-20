import {
    createProgram,
    forEachChild,
    getCombinedModifierFlags,
    getJSDocTags,
    isArrayLiteralExpression,
    isArrowFunction,
    isCallExpression,
    isClassDeclaration,
    isFunctionDeclaration,
    isFunctionExpression,
    isGetAccessorDeclaration,
    isIdentifier,
    isMethodDeclaration,
    isNewExpression,
    isPrivateIdentifier,
    isPropertyAccessExpression,
    isPropertyDeclaration,
    isSetAccessorDeclaration,
    isSpreadElement,
    isStringLiteralLike,
    isVariableDeclaration,
    isJSDocParameterTag,
    displayPartsToString,
    getTextOfJSDocComment,
    ModifierFlags,
    SymbolFlags,
    SyntaxKind,
    type ArrayLiteralExpression,
    type ClassDeclaration,
    type CompilerOptions,
    type GetAccessorDeclaration,
    type Identifier,
    type MethodDeclaration,
    type Node,
    type ParameterDeclaration,
    type Program,
    type SignatureDeclaration,
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
    /**
     * The element's default ARIA role, from a class-level `@role` jsdoc tag.
     * Typically set on the element via `ElementInternals.role`; recorded here so
     * consumers know the implicit role without parsing the source. Not part of
     * the CEM spec, but additive — manifests carrying it remain schema-valid.
     */
    role?: string;
    /** Present when the class is marked `@deprecated`; the string is the deprecation note, if any. */
    deprecated?: boolean | string;
}

export interface Attribute {
    name: string;
    description?: string;
    type?: { text: string };
    default?: string;
    fieldName?: string;
    /**
     * The allowed values when the backing property is a string-literal union
     * (`'sm' | 'md' | 'lg'`). Lets downstream generators emit enums: `.d.ts`
     * unions, VS Code custom-data `values`, and Storybook `options`.
     */
    values?: string[];
    /** Present when the attribute is marked `@deprecated`; the string is the deprecation note, if any. */
    deprecated?: boolean | string;
}

export interface ClassField {
    kind: 'field';
    name: string;
    description?: string;
    privacy: 'public' | 'private' | 'protected';
    static?: boolean;
    readonly?: boolean;
    type?: { text: string };
    default?: string;
    inheritedFrom?: { name: string };
    /** Present when the field is marked `@deprecated`; the string is the deprecation note, if any. */
    deprecated?: boolean | string;
}

/** A single parameter of a method, following the CEM `Parameter` shape. */
export interface Parameter {
    name: string;
    description?: string;
    type?: { text: string };
    optional?: boolean;
    default?: string;
    rest?: boolean;
}

export interface ClassMethod {
    kind: 'method';
    name: string;
    description?: string;
    privacy: 'public' | 'private' | 'protected';
    static?: boolean;
    parameters?: Parameter[];
    return?: { type?: { text: string }; description?: string };
    inheritedFrom?: { name: string };
    /** Present when the method is marked `@deprecated`; the string is the deprecation note, if any. */
    deprecated?: boolean | string;
}

export type ClassMember = ClassField | ClassMethod;

export interface CemEvent {
    name: string;
    description?: string;
    type?: { text: string };
    /**
     * The event's `detail` payload type, when known — from a `new CustomEvent<Detail>(...)`
     * type argument or a `@fires {Detail} name` tag. Lets downstream generators emit
     * `CustomEvent<Detail>` instead of a bare `CustomEvent`.
     */
    detailType?: { text: string };
    /** Present when the event is marked `@deprecated`; the string is the deprecation note, if any. */
    deprecated?: boolean | string;
}

export interface NamedDoc {
    name: string;
    description?: string;
}

/**
 * The event's type as source text: the constructor with its detail payload when
 * known (`CustomEvent<{ value: number }>`), otherwise the bare constructor.
 */
export function eventTypeText(event: CemEvent): string {
    const ctor = event.type?.text ?? 'CustomEvent';
    return event.detailType ? `${ctor}<${event.detailType.text}>` : ctor;
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

/**
 * Extracts the allowed values from a string-literal union type's text as the
 * TypeScript checker renders it (`"sm" | "md" | "lg"`). Returns the literal
 * values when every member is a string literal (`undefined`/`null` members are
 * tolerated for optional properties); `undefined` otherwise (e.g. `string`,
 * mixed unions, or fewer than two literals).
 */
function stringLiteralUnionValues(typeText: string | undefined): string[] | undefined {
    if (!typeText || !typeText.includes('|')) return undefined;
    const parts = typeText.split('|').map((p) => p.trim());
    const values: string[] = [];
    for (const part of parts) {
        if (part === 'undefined' || part === 'null') continue;
        const match = /^(["'])((?:[^\\]|\\.)*?)\1$/.exec(part);
        if (!match) return undefined; // a non-string-literal member → not an enum
        values.push(match[2]!.replace(/\\(["'\\])/g, '$1'));
    }
    return values.length >= 2 ? values : undefined;
}

/** Splits `name - description` (or `name description`) used by jsdoc tags like @slot/@csspart. */
/**
 * Parses a `@fires`/`@event` comment, optionally prefixed with a `{DetailType}`:
 * `@fires {{ value: number }} change - f(...)`. The leading `{...}` (balanced
 * braces) becomes the event's `detailType`; the remainder is parsed as name/desc.
 */
function parseEventTag(raw: string): CemEvent {
    const text = raw.trim();
    let detailType: { text: string } | undefined;
    let rest = text;
    if (text.startsWith('{')) {
        let depth = 0;
        let end = -1;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}' && --depth === 0) {
                end = i;
                break;
            }
        }
        if (end > 0) {
            const inner = text.slice(1, end).trim();
            if (inner) detailType = { text: inner };
            rest = text.slice(end + 1).trim();
        }
    }
    const { name, description } = parseNameDescription(rest);
    const event: CemEvent = { name };
    if (description) event.description = description;
    if (detailType) event.detailType = detailType;
    return event;
}

/**
 * Parses a `@cssprop`/`@cssproperty` comment, supporting an optional default in
 * brackets: `@cssprop [--gap=8px] - description`. The `=default` part and the
 * brackets are optional, so `@cssprop --gap - description` also works.
 */
function parseCssProperty(raw: string): CssCustomProperty {
    const text = raw.trim();
    const bracket = text.match(/^\[\s*([^\]]*?)\s*\]\s*(?:-\s*)?([\s\S]*)$/);
    if (bracket) {
        const [, decl, desc] = bracket;
        const eq = decl!.indexOf('=');
        const name = (eq >= 0 ? decl!.slice(0, eq) : decl!).trim();
        const def = eq >= 0 ? decl!.slice(eq + 1).trim() : undefined;
        const prop: CssCustomProperty = { name };
        if (def) prop.default = def;
        if (desc!.trim()) prop.description = desc!.trim();
        return prop;
    }
    const { name, description } = parseNameDescription(text);
    const eq = name.indexOf('=');
    const prop: CssCustomProperty = { name: eq >= 0 ? name.slice(0, eq) : name };
    if (eq >= 0) {
        const def = name.slice(eq + 1).trim();
        if (def) prop.default = def;
    }
    if (description) prop.description = description;
    return prop;
}

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
                !this.isInternal(node) &&
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

    /** The `extends` clause expression as written, e.g. `AuxValueElement` or `HTMLElement`. */
    private superclassNameOf(node: ClassDeclaration): string {
        const ext = node.heritageClauses?.find((c) => c.token === SyntaxKind.ExtendsKeyword);
        const type = ext?.types[0];
        return type ? type.expression.getText() : 'HTMLElement';
    }

    /** The immediate base class declaration this class extends, if it resolves in the program. */
    private resolveBaseClass(node: ClassDeclaration): ClassDeclaration | undefined {
        const ext = node.heritageClauses?.find((c) => c.token === SyntaxKind.ExtendsKeyword);
        const type = ext?.types[0];
        return type ? this.resolveClassDeclaration(type.expression) : undefined;
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

        const deprecated = this.deprecationOf(node);
        if (deprecated !== undefined) decl.deprecated = deprecated;

        decl.superclass = { name: this.superclassNameOf(node) };

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
            else if (tagName === 'cssprop' || tagName === 'cssproperty') cssProperties.push(parseCssProperty(comment));
            else if (tagName === 'fires' || tagName === 'event') taggedEvents.push(parseEventTag(comment));
            else if (tagName === 'summary') {
                const summary = comment.trim();
                if (summary) decl.summary = summary;
            } else if (tagName === 'role') {
                const role = comment.trim();
                if (role) decl.role = role;
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

    /**
     * Public API surface of the class, flattening members inherited from custom
     * intermediate base classes into the subclass entry (CEM convention). Inherited
     * members are annotated with `inheritedFrom`; an override in the subclass wins.
     * The walk stops at `HTMLElement` (which does not resolve to a ClassDeclaration).
     */
    private collectMembers(node: ClassDeclaration): ClassMember[] {
        const byName = new Map<string, ClassMember>();
        for (const member of this.collectOwnMembers(node)) byName.set(member.name, member);

        const seen = new Set<ClassDeclaration>([node]);
        let base = this.resolveBaseClass(node);
        while (base && !seen.has(base)) {
            seen.add(base);
            const baseName = base.name?.text;
            for (const member of this.collectOwnMembers(base)) {
                if (byName.has(member.name)) continue; // subclass override wins
                byName.set(member.name, baseName ? { ...member, inheritedFrom: { name: baseName } } : member);
            }
            base = this.resolveBaseClass(base);
        }
        return [...byName.values()];
    }

    /** Public fields, accessors (as fields), and public non-lifecycle methods declared on this class. */
    private collectOwnMembers(node: ClassDeclaration): ClassMember[] {
        const fields = new Map<string, ClassField>();
        const getters = new Set<string>();
        const setters = new Set<string>();
        const methods: ClassMethod[] = [];

        for (const member of node.members) {
            const memberName = member.name && 'text' in member.name ? (member.name as { text: string }).text : undefined;
            if (!memberName) continue;
            const privacy = this.privacyOf(member);
            const isStatic = (getCombinedModifierFlags(member) & ModifierFlags.Static) !== 0;

            if (isPropertyDeclaration(member) || isGetAccessorDeclaration(member) || isSetAccessorDeclaration(member)) {
                if (privacy !== 'public' || isStatic || this.isInternal(member)) continue;
                if (isGetAccessorDeclaration(member)) getters.add(memberName);
                if (isSetAccessorDeclaration(member)) setters.add(memberName);
                const existing = fields.get(memberName);
                const field: ClassField = existing ?? { kind: 'field', name: memberName, privacy };
                const description = this.descriptionOf(member);
                if (description && !field.description) field.description = description;
                const typeText = this.typeTextOf(member);
                if (typeText && !field.type) field.type = { text: typeText };
                if (isPropertyDeclaration(member) && member.initializer && field.default === undefined) {
                    field.default = member.initializer.getText();
                }
                if (isPropertyDeclaration(member) && getCombinedModifierFlags(member) & ModifierFlags.Readonly) {
                    field.readonly = true;
                }
                const deprecated = this.deprecationOf(member);
                if (deprecated !== undefined && field.deprecated === undefined) field.deprecated = deprecated;
                fields.set(memberName, field);
            } else if (isMethodDeclaration(member)) {
                if (privacy !== 'public' || LIFECYCLE_MEMBERS.has(memberName) || this.isInternal(member)) continue;
                const method: ClassMethod = { kind: 'method', name: memberName, privacy };
                if (isStatic) method.static = true;
                const description = this.descriptionOf(member);
                if (description) method.description = description;
                const parameters = this.parametersOf(member);
                if (parameters.length) method.parameters = parameters;
                const ret = this.returnTypeOf(member);
                const retDescription = this.returnDescriptionOf(member);
                if (ret || retDescription) {
                    method.return = {};
                    if (ret) method.return.type = { text: ret };
                    if (retDescription) method.return.description = retDescription;
                }
                const deprecated = this.deprecationOf(member);
                if (deprecated !== undefined) method.deprecated = deprecated;
                methods.push(method);
            }
        }

        // A getter with no corresponding setter is a read-only property.
        for (const [name, field] of fields) {
            if (getters.has(name) && !setters.has(name)) field.readonly = true;
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
        const observed = this.findObservedAttributes(node);
        if (!observed || !observed.body) return [];

        const names: string[] = [];
        const visit = (n: Node): void => {
            if (isStringLiteralLike(n)) {
                names.push(n.text);
                return;
            }
            // `static get observedAttributes() { return [...Base.attrs, 'c']; }` — expand a
            // spread of a static (or module-level) string array declared on a base class.
            if (isSpreadElement(n)) {
                const expanded = this.resolveStringArray(n.expression);
                if (expanded) {
                    names.push(...expanded);
                    return;
                }
            }
            forEachChild(n, visit);
        };
        for (const statement of observed.body.statements) visit(statement);

        return names.map((attrName) => {
            const attr: Attribute = { name: attrName };
            const field = members.find((m): m is ClassField => m.kind === 'field' && m.name === attrName);
            if (field) {
                attr.fieldName = field.name;
                if (field.type) {
                    attr.type = field.type;
                    const values = stringLiteralUnionValues(field.type.text);
                    if (values) attr.values = values;
                }
                if (field.default !== undefined) attr.default = field.default;
                if (field.description) attr.description = field.description;
                if (field.deprecated !== undefined) attr.deprecated = field.deprecated;
            }
            return attr;
        });
    }

    /**
     * The `static get observedAttributes()` getter, searched up the base-class chain.
     * A subclass that does not re-declare it inherits the nearest base's getter (static
     * accessors are inherited through the constructor prototype chain at runtime).
     */
    private findObservedAttributes(node: ClassDeclaration): GetAccessorDeclaration | undefined {
        const seen = new Set<ClassDeclaration>();
        let current: ClassDeclaration | undefined = node;
        while (current && !seen.has(current)) {
            seen.add(current);
            const observed = current.members.find(
                (m) => isGetAccessorDeclaration(m) && m.name.getText() === 'observedAttributes'
            );
            if (observed && isGetAccessorDeclaration(observed)) return observed;
            current = this.resolveBaseClass(current);
        }
        return undefined;
    }

    /** Resolves an identifier / property-access referring to a (static or const) string array literal. */
    private resolveStringArray(expr: Node, seen: Set<Node> = new Set()): string[] | undefined {
        if (seen.has(expr)) return undefined;
        seen.add(expr);
        let symbol = this.checker.getSymbolAtLocation(expr);
        if (symbol && symbol.flags & SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol);
        for (const decl of symbol?.declarations ?? []) {
            const init =
                isPropertyDeclaration(decl) || isVariableDeclaration(decl) ? decl.initializer : undefined;
            if (init && isArrayLiteralExpression(init)) return this.stringLiteralsFrom(init, seen);
        }
        return undefined;
    }

    /** String literals from an array literal, recursively expanding nested spreads of string arrays. */
    private stringLiteralsFrom(arr: ArrayLiteralExpression, seen: Set<Node>): string[] {
        const out: string[] = [];
        for (const el of arr.elements) {
            if (isStringLiteralLike(el)) out.push(el.text);
            else if (isSpreadElement(el)) {
                const nested = this.resolveStringArray(el.expression, seen);
                if (nested) out.push(...nested);
            }
        }
        return out;
    }

    /**
     * Events from `new CustomEvent('name')` / `new Event('name')` anywhere in the class, plus
     * events dispatched through a one-hop helper such as `emit(this, 'input', ...)`: the helper
     * is resolved and the parameter it forwards as the event type is matched back to the
     * string literal at the call site.
     */
    private collectDispatchedEvents(node: ClassDeclaration): CemEvent[] {
        const events = new Map<string, CemEvent>();
        const visit = (n: Node): void => {
            if (isNewExpression(n)) {
                const ctor = n.expression.getText();
                if ((ctor === 'CustomEvent' || ctor === 'Event') && n.arguments && n.arguments.length > 0) {
                    const first = n.arguments[0];
                    if (first && isStringLiteralLike(first)) {
                        const event: CemEvent = { name: first.text, type: { text: ctor } };
                        const detail = n.typeArguments?.[0];
                        if (detail) event.detailType = { text: detail.getText() };
                        events.set(first.text, event);
                    }
                }
            } else if (isCallExpression(n)) {
                const event = this.eventFromHelperCall(n);
                if (event) events.set(event.name, event);
            }
            forEachChild(n, visit);
        };
        visit(node);
        return [...events.values()];
    }

    /** Cache of `helper symbol declaration -> { typeParamIndex, ctor }` (or null if not a dispatch helper). */
    private helperDispatchCache = new Map<Node, { index: number; ctor: string } | null>();

    /** If `call` invokes a one-hop event-dispatch helper with a literal type argument, the event. */
    private eventFromHelperCall(call: Node): CemEvent | undefined {
        if (!isCallExpression(call) || !isIdentifier(call.expression)) return undefined;
        const fn = this.resolveFunctionLike(call.expression);
        if (!fn) return undefined;
        const info = this.dispatchHelperInfo(fn);
        if (!info) return undefined;
        const arg = call.arguments[info.index];
        if (arg && isStringLiteralLike(arg)) {
            const event: CemEvent = { name: arg.text, type: { text: info.ctor } };
            const detail = call.typeArguments?.[0];
            if (detail) event.detailType = { text: detail.getText() };
            return event;
        }
        return undefined;
    }

    /** Resolves a called identifier to its function declaration or function-valued variable. */
    private resolveFunctionLike(expr: Node): SignatureDeclaration | undefined {
        let symbol = this.checker.getSymbolAtLocation(expr);
        if (symbol && symbol.flags & SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol);
        for (const decl of symbol?.declarations ?? []) {
            if (isFunctionDeclaration(decl)) return decl;
            if (isVariableDeclaration(decl) && decl.initializer) {
                if (isArrowFunction(decl.initializer) || isFunctionExpression(decl.initializer)) {
                    return decl.initializer;
                }
            }
        }
        return undefined;
    }

    /** Which parameter a helper forwards as a CustomEvent/Event type, and the constructor used. */
    private dispatchHelperInfo(fn: SignatureDeclaration): { index: number; ctor: string } | null {
        const cached = this.helperDispatchCache.get(fn);
        if (cached !== undefined) return cached;
        let result: { index: number; ctor: string } | null = null;
        const body = (fn as { body?: Node }).body;
        if (body) {
            const visit = (n: Node): void => {
                if (result) return;
                if (isNewExpression(n)) {
                    const ctor = n.expression.getText();
                    const first = n.arguments?.[0];
                    if ((ctor === 'CustomEvent' || ctor === 'Event') && first && isIdentifier(first)) {
                        const index = fn.parameters.findIndex(
                            (p) => isIdentifier(p.name) && p.name.text === (first as Identifier).text
                        );
                        if (index >= 0) {
                            result = { index, ctor };
                            return;
                        }
                    }
                }
                forEachChild(n, visit);
            };
            visit(body);
        }
        this.helperDispatchCache.set(fn, result);
        return result;
    }

    private mergeEvents(detected: CemEvent[], tagged: CemEvent[]): CemEvent[] {
        const byName = new Map<string, CemEvent>();
        for (const e of detected) byName.set(e.name, e);
        for (const e of tagged) {
            const existing = byName.get(e.name);
            if (existing) {
                if (!existing.description && e.description) existing.description = e.description;
                if (!existing.detailType && e.detailType) existing.detailType = e.detailType;
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

    /**
     * The deprecation status of a node from its `@deprecated` jsdoc tag: the note
     * text if one is given, `true` for a bare tag, or `undefined` when absent.
     */
    private deprecationOf(node: Node): boolean | string | undefined {
        for (const tag of getJSDocTags(node)) {
            if (tag.tagName.text.toLowerCase() === 'deprecated') {
                const note = getTextOfJSDocComment(tag.comment)?.trim();
                return note ? note : true;
            }
        }
        return undefined;
    }

    /** Whether a node is marked `@internal` or `@ignore` and should be omitted from the manifest. */
    private isInternal(node: Node): boolean {
        for (const tag of getJSDocTags(node)) {
            const name = tag.tagName.text.toLowerCase();
            if (name === 'internal' || name === 'ignore') return true;
        }
        return false;
    }

    /** The declared parameters of a method, with types, optionality, defaults and `@param` descriptions. */
    private parametersOf(method: MethodDeclaration): Parameter[] {
        const descriptions = this.paramDescriptions(method);
        return method.parameters.map((param: ParameterDeclaration) => {
            const name = param.name.getText();
            const entry: Parameter = { name };
            const description = descriptions.get(name);
            if (description) entry.description = description;
            const typeText = param.type ? param.type.getText() : this.typeTextOf(param);
            if (typeText) entry.type = { text: typeText };
            if (param.questionToken || param.initializer) entry.optional = true;
            if (param.initializer) entry.default = param.initializer.getText();
            if (param.dotDotDotToken) entry.rest = true;
            return entry;
        });
    }

    /** Maps parameter name -> `@param` description text from a method's jsdoc. */
    private paramDescriptions(method: MethodDeclaration): Map<string, string> {
        const map = new Map<string, string>();
        for (const tag of getJSDocTags(method)) {
            if (isJSDocParameterTag(tag)) {
                const text = getTextOfJSDocComment(tag.comment)?.trim();
                if (text) map.set(tag.name.getText(), text);
            }
        }
        return map;
    }

    /** The resolved return type of a method, or undefined for `void`/unknown. */
    private returnTypeOf(method: MethodDeclaration): string | undefined {
        try {
            const signature = this.checker.getSignatureFromDeclaration(method);
            if (!signature) return undefined;
            const text = this.checker.typeToString(this.checker.getReturnTypeOfSignature(signature));
            return text && text !== 'any' && text !== 'error' && text !== 'void' ? text : undefined;
        } catch {
            return undefined;
        }
    }

    /** The `@returns`/`@return` description from a method's jsdoc. */
    private returnDescriptionOf(method: MethodDeclaration): string | undefined {
        for (const tag of getJSDocTags(method)) {
            const name = tag.tagName.text.toLowerCase();
            if (name === 'returns' || name === 'return') {
                const text = getTextOfJSDocComment(tag.comment)?.trim();
                if (text) return text;
            }
        }
        return undefined;
    }
}
