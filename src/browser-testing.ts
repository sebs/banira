/**
 * Pure helpers behind the Playwright-backed accessibility (#14) and visual
 * snapshot (#15) testing on {@link TestHelper.mountInBrowser}. Kept free of any
 * browser/Playwright calls so they can be unit-tested without a real browser.
 */

/** A single axe-core accessibility violation, flattened for assertions. */
export interface A11yViolation {
    id: string;
    impact: string | null;
    description: string;
    help: string;
    helpUrl: string;
    /** Number of DOM nodes that triggered this rule. */
    nodes: number;
}

/** Outcome of an axe-core run against a mounted component. */
export interface A11yResult {
    passed: boolean;
    violations: A11yViolation[];
    /** Count of checks axe could not complete (need a human review). */
    incomplete: number;
}

/** The shape of an axe-core result we read from (a subset of `axe.run`'s output). */
export interface RawAxeResults {
    violations?: Array<{
        id: string;
        impact?: string | null;
        description?: string;
        help?: string;
        helpUrl?: string;
        nodes?: unknown[];
    }>;
    incomplete?: unknown[];
}

/** Flattens raw `axe.run` output into a stable {@link A11yResult}. */
export function summarizeA11y(raw: RawAxeResults): A11yResult {
    const violations = (raw.violations ?? []).map((v) => ({
        id: v.id,
        impact: v.impact ?? null,
        description: v.description ?? '',
        help: v.help ?? '',
        helpUrl: v.helpUrl ?? '',
        nodes: Array.isArray(v.nodes) ? v.nodes.length : 0,
    }));
    return {
        passed: violations.length === 0,
        violations,
        incomplete: Array.isArray(raw.incomplete) ? raw.incomplete.length : 0,
    };
}

/** A human-readable one-line-per-violation report, for assertion messages. */
export function formatA11yViolations(result: A11yResult): string {
    if (result.passed) return 'No accessibility violations.';
    return result.violations
        .map((v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.help} — ${v.nodes} node(s) — ${v.helpUrl}`)
        .join('\n');
}

/** Outcome of a visual snapshot comparison. */
export interface ScreenshotResult {
    /** True when the screenshot matched the baseline (or a new baseline was just written). */
    matched: boolean;
    /** True when no baseline existed and this run created it. */
    created: boolean;
    baselinePath: string;
    /** Where the mismatching screenshot was written, when `matched` is false. */
    actualPath?: string;
}

/**
 * Resolves the on-disk baseline PNG path for a named snapshot.
 *
 * Trusted-input contract: `dir` is a trusted configuration value (the caller's
 * chosen baseline directory) and is used verbatim — do NOT derive it from
 * untrusted input, since the snapshot is then written under it. The snapshot
 * `name`, by contrast, is sanitized here (non-`[A-Za-z0-9._-]` runs collapse to
 * `-`), so it cannot contain a path separator and cannot escape `dir`. This is a
 * trusted-author test API and is not reachable from the MCP server. See
 * security-findings (baselineDir residual).
 */
export function resolveBaselinePath(dir: string, name: string): string {
    const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const file = safe.endsWith('.png') ? safe : `${safe}.png`;
    return `${dir.replace(/\/+$/, '')}/${file}`;
}

/** The sibling path a mismatching screenshot is written to (`x.png` → `x.actual.png`). */
export function actualPathFor(baselinePath: string): string {
    return baselinePath.replace(/\.png$/, '.actual.png');
}

/** Exact byte comparison of two PNG buffers (Playwright renders deterministically). */
export function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
