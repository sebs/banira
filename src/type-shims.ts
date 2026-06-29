import { eventTypeText } from './manifest.js';
import type { ClassField, ClassMethod, CustomElementDeclaration, Package } from './manifest.js';

export interface TypeShimOptions {
    /** Also augment `JSX.IntrinsicElements` so the tags type-check in JSX/TSX (default false). */
    jsx?: boolean;
}

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

/**
 * A member name safe to emit inside an interface: bare when it's a valid
 * identifier, otherwise a JSON-quoted+escaped string-literal member. A manifest
 * member name is verbatim source (a class can have a string-literal/computed
 * name), so without this a hostile name like `x: 1;}\ndeclare global {...` would
 * close the interface early and inject top-level declarations. See finding #23.
 */
function memberName(name: string): string {
    return IDENT_RE.test(name) ? name : JSON.stringify(name);
}

/** A parameter name safe to emit in a signature: the name if a valid identifier, else a positional placeholder. */
function paramName(name: string, index: number): string {
    return IDENT_RE.test(name) ? name : `arg${index}`;
}

/** Neutralise a doc-comment line so it can't terminate the `/* *​/` block or carry control chars. */
function safeDocLine(line: string): string {
    // eslint-disable-next-line no-control-regex
    return line.replace(/\*\//g, '*\\/').replace(/[\u0000-\u001f]/g, " ");
}

/** A safe TypeScript interface name derived from a custom element declaration. */
function interfaceName(decl: CustomElementDeclaration): string {
    const base = decl.name && /^[A-Za-z_$][\w$]*$/.test(decl.name)
        ? decl.name
        : (decl.tagName ?? 'Unknown')
              .split(/[^A-Za-z0-9]+/)
              .filter(Boolean)
              .map((s) => s[0]!.toUpperCase() + s.slice(1))
              .join('');
    return `${base}Element`;
}

function docComment(description: string | undefined, deprecated: boolean | string | undefined, indent: string): string {
    const lines: string[] = [];
    if (description) lines.push(...description.split(/\r?\n/));
    if (deprecated !== undefined) lines.push(`@deprecated${typeof deprecated === 'string' ? ` ${deprecated}` : ''}`);
    if (lines.length === 0) return '';
    if (lines.length === 1) return `${indent}/** ${safeDocLine(lines[0]!)} */\n`;
    return `${indent}/**\n${lines.map((l) => `${indent} * ${safeDocLine(l)}`).join('\n')}\n${indent} */\n`;
}

function fieldMember(field: ClassField): string {
    const doc = docComment(field.description, field.deprecated, '  ');
    const ro = field.readonly ? 'readonly ' : '';
    const type = field.type?.text ?? 'unknown';
    return `${doc}  ${ro}${memberName(field.name)}: ${type};`;
}

function methodMember(method: ClassMethod): string {
    const doc = docComment(method.description, method.deprecated, '  ');
    const params = (method.parameters ?? [])
        .map((p, i) => `${p.rest ? '...' : ''}${paramName(p.name, i)}${p.optional && !p.rest ? '?' : ''}: ${p.type?.text ?? 'unknown'}`)
        .join(', ');
    const ret = method.return?.type?.text ?? 'void';
    return `${doc}  ${memberName(method.name)}(${params}): ${ret};`;
}

/**
 * Typed `addEventListener`/`removeEventListener` overloads for the element's
 * documented events, so `el.addEventListener('change', e => e.detail…)` knows the
 * payload shape. Only emitted for events whose type is known.
 */
function eventListenerOverloads(decl: CustomElementDeclaration, name: string): string[] {
    const events = decl.events ?? [];
    if (!events.length) return [];
    const lines: string[] = [];
    for (const e of events) {
        const doc = docComment(e.description, e.deprecated, '  ');
        const evType = eventTypeText(e);
        const evName = JSON.stringify(e.name);
        lines.push(
            `${doc}  addEventListener(type: ${evName}, listener: (this: ${name}, ev: ${evType}) => void, options?: boolean | AddEventListenerOptions): void;`
        );
        lines.push(
            `  removeEventListener(type: ${evName}, listener: (this: ${name}, ev: ${evType}) => void, options?: boolean | EventListenerOptions): void;`
        );
    }
    return lines;
}

function declarationInterface(decl: CustomElementDeclaration): string {
    const name = interfaceName(decl);
    // Include members inherited from the user's own base classes (tagged with
    // `inheritedFrom`). The interface always `extends HTMLElement`, never the
    // base, so skipping them would drop the inherited API entirely. The analyzer
    // flattens only the user's class chain — DOM built-ins are not in `members`
    // and members are deduped by name (override wins), so emitting all is safe.
    const members = (decl.members ?? [])
        .map((m) => (m.kind === 'field' ? fieldMember(m) : methodMember(m)));
    const listeners = eventListenerOverloads(decl, name);
    const lines = [...members, ...listeners];
    const body = lines.length ? `\n${lines.join('\n')}\n` : '';
    const doc = docComment(decl.description ?? decl.summary, decl.deprecated, '');
    return `${doc}export interface ${name} extends HTMLElement {${body}}`;
}

/**
 * Generates a self-contained `.d.ts` from a Custom Elements Manifest: one
 * `HTMLElement`-extending interface per custom element plus an
 * `HTMLElementTagNameMap` augmentation, so `document.querySelector('my-el')`
 * and `document.createElement('my-el')` are correctly typed with no runtime
 * import. With `{ jsx: true }` it also augments `JSX.IntrinsicElements`.
 */
export function toTypeDefinitions(pkg: Package, options: TypeShimOptions = {}): string {
    const decls = pkg.modules.flatMap((m) => m.declarations).filter((d) => d.tagName);

    const interfaces = decls.map(declarationInterface);
    const tagMap = decls.map((d) => `    ${JSON.stringify(d.tagName)}: ${interfaceName(d)};`).join('\n');

    const globalBlocks = [`  interface HTMLElementTagNameMap {\n${tagMap}\n  }`];
    if (options.jsx) {
        const jsxMap = decls
            .map((d) => `      ${JSON.stringify(d.tagName)}: Partial<${interfaceName(d)}> & { [attr: string]: unknown };`)
            .join('\n');
        globalBlocks.push(`  namespace JSX {\n    interface IntrinsicElements {\n${jsxMap}\n    }\n  }`);
    }

    return [
        '// Generated by banira from the Custom Elements Manifest. Do not edit by hand.',
        '',
        interfaces.join('\n\n'),
        '',
        `declare global {\n${globalBlocks.join('\n\n')}\n}`,
        '',
        'export {};',
        '',
    ].join('\n');
}
