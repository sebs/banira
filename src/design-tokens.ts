import type { CssCustomProperty, CustomElementDeclaration, Package } from './manifest.js';

/** A single CSS custom property (design token) on a component. */
export interface DesignToken {
    name: string;
    default?: string;
    description?: string;
}

/** The design tokens of one component, bucketed by their leading name segment. */
export interface ComponentTokens {
    tagName: string;
    description?: string;
    /** Tokens grouped by their first dashed segment (`--rating-color` -> `rating`). */
    groups: { name: string; tokens: DesignToken[] }[];
}

export interface DesignTokensOptions {
    /** Top-level document title (default: `Design Tokens`). */
    title?: string;
    /** Heading level for each component section (1-6, default 2). */
    headingLevel?: number;
}

/**
 * The group a token belongs to: its first dashed segment after the `--` prefix.
 * `--rating-active-color` -> `rating`; a single-segment token like `--gap` -> `general`.
 */
function groupOf(name: string): string {
    const segments = name.replace(/^--/, '').split('-').filter(Boolean);
    return segments.length > 1 ? segments[0]! : 'general';
}

function tokensForDeclaration(decl: CustomElementDeclaration): ComponentTokens {
    const byGroup = new Map<string, DesignToken[]>();
    for (const prop of (decl.cssProperties ?? []) as CssCustomProperty[]) {
        const group = groupOf(prop.name);
        const token: DesignToken = { name: prop.name };
        if (prop.default !== undefined) token.default = prop.default;
        if (prop.description !== undefined) token.description = prop.description;
        let bucket = byGroup.get(group);
        if (!bucket) byGroup.set(group, (bucket = []));
        bucket.push(token);
    }
    const groups = [...byGroup.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, tokens]) => ({ name, tokens: tokens.sort((x, y) => x.name.localeCompare(y.name)) }));
    const result: ComponentTokens = { tagName: decl.tagName!, groups };
    const description = decl.description ?? decl.summary;
    if (description !== undefined) result.description = description;
    return result;
}

/**
 * Extracts the design tokens (CSS custom properties) of every custom element in
 * a manifest, grouped per component and by token namespace. Components without
 * any documented CSS custom properties are omitted.
 */
export function collectDesignTokens(pkg: Package): ComponentTokens[] {
    return pkg.modules
        .flatMap((m) => m.declarations)
        .filter((d): d is CustomElementDeclaration => Boolean(d.tagName && (d.cssProperties?.length ?? 0) > 0))
        .map(tokensForDeclaration);
}

function escapeCell(value: string | undefined): string {
    return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function code(value: string | undefined): string {
    return value ? `\`${escapeCell(value)}\`` : '';
}

/**
 * Renders a dedicated theming / design-tokens document from a manifest: one
 * section per component, tokens grouped by namespace, with defaults and
 * descriptions. Distinct from `manifestToMarkdown`'s inline per-component table.
 */
export function designTokensToMarkdown(pkg: Package, options: DesignTokensOptions = {}): string {
    const title = options.title ?? 'Design Tokens';
    const level = Math.min(Math.max(options.headingLevel ?? 2, 1), 6);
    const hx = '#'.repeat(level);
    const components = collectDesignTokens(pkg);

    const out: string[] = [`# ${title}`];
    if (components.length === 0) {
        out.push('', '_No CSS custom properties are documented in this manifest._');
        return out.join('\n') + '\n';
    }

    for (const component of components) {
        out.push('', `${hx} \`<${component.tagName}>\``);
        if (component.description) out.push('', component.description);
        const grouped = component.groups.length > 1 || component.groups[0]?.name !== 'general';
        for (const group of component.groups) {
            if (grouped) out.push('', `${'#'.repeat(Math.min(level + 1, 6))} ${group.name}`);
            out.push('', '| Token | Default | Description |', '| --- | --- | --- |');
            for (const t of group.tokens) {
                out.push(`| ${code(t.name)} | ${code(t.default)} | ${escapeCell(t.description)} |`);
            }
        }
    }
    return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// W3C Design Tokens (DTCG) import — tokens.json -> CSS custom properties (#28)
// ---------------------------------------------------------------------------

/** A single design token imported from a DTCG document, resolved to a CSS value. */
export interface ImportedToken {
    /** CSS custom property name, e.g. `--color-primary`. */
    name: string;
    /** Dotted path in the source document, e.g. `color.primary`. */
    path: string;
    /** The resolved value as a CSS string (aliases and `{ref}`s flattened). */
    value: string;
    /** The DTCG `$type` (own or inherited from a parent group), if declared. */
    type?: string;
    /** The DTCG `$description`, if declared. */
    description?: string;
}

interface RawToken {
    path: string[];
    rawValue: unknown;
    type?: string;
    description?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Walks a DTCG document collecting every token (a node carrying `$value`),
 * tracking the dotted path and the `$type` inherited from ancestor groups.
 */
function collectRawTokens(node: unknown, path: string[], inheritedType: string | undefined, out: RawToken[]): void {
    if (!isPlainObject(node)) return;
    const type = typeof node.$type === 'string' ? node.$type : inheritedType;
    if ('$value' in node) {
        const raw: RawToken = { path, rawValue: node.$value };
        if (type !== undefined) raw.type = type;
        if (typeof node.$description === 'string') raw.description = node.$description;
        out.push(raw);
        return; // DTCG tokens are leaves; do not descend further
    }
    for (const [key, child] of Object.entries(node)) {
        if (key.startsWith('$')) continue; // $type / $description / other metadata
        collectRawTokens(child, [...path, key], type, out);
    }
}

/** `['color', 'primary']` -> `--color-primary`; non-alphanumeric chars become `-`. */
function tokenCssName(path: string[]): string {
    const joined = path
        .map((segment) => segment.replace(/[^A-Za-z0-9]+/g, '-'))
        .join('-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return `--${joined}`;
}

/** Renders a non-string DTCG `$value` to a CSS string, or `undefined` if unsupported. */
function renderRawValue(rawValue: unknown): string | undefined {
    if (typeof rawValue === 'number') return String(rawValue);
    // DTCG dimension/duration objects: { value, unit }.
    if (isPlainObject(rawValue) && 'value' in rawValue && 'unit' in rawValue) {
        return `${String(rawValue.value)}${String(rawValue.unit)}`;
    }
    return undefined; // composite tokens (shadow, typography, gradient, …) are skipped
}

/**
 * Resolves a token's value by dotted path, following DTCG `{alias}` references
 * (whole-value and embedded), with memoization and cycle detection.
 */
function resolveTokenValue(
    pathStr: string,
    byPath: Map<string, RawToken>,
    memo: Map<string, string | undefined>,
    stack: Set<string>
): string | undefined {
    if (memo.has(pathStr)) return memo.get(pathStr);
    if (stack.has(pathStr)) throw new Error(`circular token reference at {${pathStr}}`);
    const raw = byPath.get(pathStr);
    if (!raw) return undefined; // dangling reference

    stack.add(pathStr);
    let value: string | undefined;
    const rv = raw.rawValue;
    if (typeof rv === 'string') {
        value = /\{[^}]+\}/.test(rv)
            ? rv.replace(/\{([^}]+)\}/g, (_match, ref: string) => resolveTokenValue(ref, byPath, memo, stack) ?? `{${ref}}`)
            : rv;
    } else {
        value = renderRawValue(rv);
    }
    stack.delete(pathStr);
    memo.set(pathStr, value);
    return value;
}

/**
 * Parses a [W3C Design Tokens (DTCG)](https://tr.designtokens.org/format/)
 * document into a flat list of CSS custom properties. Groups become dashed
 * name segments, `$type` is inherited from ancestor groups, and `{alias}`
 * references (whole-value and embedded) are resolved. Composite tokens
 * (shadow, typography, …) whose value cannot be expressed as a single CSS
 * string are skipped.
 *
 * @throws Error if the document is not a JSON object, or a reference is circular.
 */
export function parseDesignTokens(doc: unknown): ImportedToken[] {
    if (!isPlainObject(doc)) throw new Error('DTCG tokens document must be a JSON object');
    const raws: RawToken[] = [];
    collectRawTokens(doc, [], undefined, raws);

    const byPath = new Map(raws.map((r) => [r.path.join('.'), r] as const));
    const memo = new Map<string, string | undefined>();
    const tokens: ImportedToken[] = [];
    for (const raw of raws) {
        const pathStr = raw.path.join('.');
        const value = resolveTokenValue(pathStr, byPath, memo, new Set());
        if (value === undefined) continue; // unsupported/composite/dangling
        const token: ImportedToken = { name: tokenCssName(raw.path), path: pathStr, value };
        if (raw.type !== undefined) token.type = raw.type;
        if (raw.description !== undefined) token.description = raw.description;
        tokens.push(token);
    }
    return tokens;
}

/** Escapes the CSS comment terminator so a token description is safe to embed in a comment. */
function cssComment(description: string): string {
    return ` /* ${description.replace(/\*\//g, '*\\/').replace(/\r?\n/g, ' ')} */`;
}

/**
 * Emits a CSS rule declaring the imported tokens as custom properties, e.g.
 * `:root { --color-primary: #36f; }`. Descriptions become trailing comments.
 */
export function designTokensToCss(tokens: ImportedToken[], options: { selector?: string } = {}): string {
    const selector = options.selector ?? ':root';
    const body = tokens
        .map((t) => `  ${t.name}: ${t.value};${t.description ? cssComment(t.description) : ''}`)
        .join('\n');
    return body ? `${selector} {\n${body}\n}\n` : `${selector} {\n}\n`;
}

/** Maps imported tokens to manifest `cssProperties` entries (name, default, description). */
export function tokensToCssProperties(tokens: ImportedToken[]): CssCustomProperty[] {
    return tokens.map((t) => {
        const prop: CssCustomProperty = { name: t.name, default: t.value };
        if (t.description !== undefined) prop.description = t.description;
        return prop;
    });
}

/**
 * Enriches a manifest in place: for every component CSS custom property whose
 * name matches an imported token, fills in a missing `default` (and
 * `description`) from the token document — closing the loop between authored
 * tokens and the doc table banira already renders.
 *
 * @returns the number of `cssProperties` entries that were enriched.
 */
export function enrichManifestCssProperties(pkg: Package, tokens: ImportedToken[]): number {
    const byName = new Map(tokens.map((t) => [t.name, t] as const));
    let enriched = 0;
    for (const module of pkg.modules) {
        for (const decl of module.declarations) {
            for (const prop of (decl as CustomElementDeclaration).cssProperties ?? []) {
                const token = byName.get(prop.name);
                if (!token) continue;
                let changed = false;
                if (prop.default === undefined) {
                    prop.default = token.value;
                    changed = true;
                }
                if (prop.description === undefined && token.description !== undefined) {
                    prop.description = token.description;
                    changed = true;
                }
                if (changed) enriched++;
            }
        }
    }
    return enriched;
}
