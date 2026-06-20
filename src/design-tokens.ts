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
