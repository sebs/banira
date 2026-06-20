import type { CompilerOptions } from 'typescript';
import { Compiler } from './compiler.js';
import { ManifestGenerator, type CustomElementDeclaration } from './manifest.js';
import { TestHelper } from './test-helper.js';
import { checkReflection } from './smoke-checks.js';

export type LintSeverity = 'error' | 'warning';

/** A single Gold Standard / documentation-coverage finding for a component. */
export interface LintIssue {
    /** Stable rule id (e.g. `reflection`, `undocumented-event`). */
    rule: string;
    severity: LintSeverity;
    tagName: string;
    message: string;
}

export interface LintResult {
    tagName: string;
    file: string;
    issues: LintIssue[];
}

/** The lint rules, with a one-line description. `banira lint --rules` filters by id. */
export const LINT_RULES: { id: string; description: string }[] = [
    { id: 'reflection', description: 'observed attributes reflect to/from their backing property' },
    { id: 'host-overridable', description: ':host styles avoid !important so consumers can override them' },
    { id: 'undocumented-event', description: 'dispatched events are documented with @fires' },
    { id: 'undocumented-attribute', description: 'observed attributes have a jsdoc description' },
    { id: 'undocumented-part', description: 'exposed part="…" elements are documented with @csspart' },
    { id: 'undocumented-slot', description: 'rendered <slot>s are documented with @slot (content model)' },
];

export interface LintOptions {
    compilerOptions?: CompilerOptions;
    readyTimeout?: number;
    /** Restrict to these rule ids (default: all of {@link LINT_RULES}). */
    rules?: string[];
}

/* Narrow structural types for the JSDOM values we read. */
interface DomStyleRule {
    selectorText?: string;
    cssText: string;
}
interface DomElementLike {
    getAttribute(name: string): string | null;
    textContent: string | null;
}
interface DomShadowRoot {
    querySelectorAll(selector: string): ArrayLike<DomElementLike>;
    adoptedStyleSheets?: ArrayLike<{ cssRules: ArrayLike<DomStyleRule> }>;
}

/** Collects `:host` selectors that use `!important` from raw CSS text (block-by-block). */
function findHostImportant(cssText: string, out: string[]): void {
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = ruleRe.exec(cssText)) !== null) {
        const selector = match[1]!.trim();
        if (selector.includes(':host') && /!important/i.test(match[2]!)) out.push(selector);
    }
}

interface Probe {
    /** part names exposed via `part="…"` in the shadow root. */
    parts: Set<string>;
    /** slot names rendered in the shadow root (empty string = default slot). */
    slots: Set<string>;
    /** `:host` selectors that use `!important`. */
    hostImportant: string[];
}

/** Inspects a mounted element's shadow root for parts, slots, and un-overridable host styles. */
function probeShadow(shadow: DomShadowRoot): Probe {
    const parts = new Set<string>();
    for (const el of Array.from(shadow.querySelectorAll('[part]'))) {
        for (const token of (el.getAttribute('part') ?? '').split(/\s+/).filter(Boolean)) parts.add(token);
    }

    const slots = new Set<string>();
    for (const el of Array.from(shadow.querySelectorAll('slot'))) slots.add(el.getAttribute('name') ?? '');

    const hostImportant: string[] = [];
    // JSDOM leaves `.sheet` null for shadow `<style>` elements, so parse their text.
    for (const styleEl of Array.from(shadow.querySelectorAll('style'))) {
        findHostImportant(styleEl.textContent ?? '', hostImportant);
    }
    // Adopted constructable stylesheets do expose `cssRules` in JSDOM.
    for (const sheet of Array.from(shadow.adoptedStyleSheets ?? [])) {
        let rules: ArrayLike<DomStyleRule>;
        try {
            rules = sheet.cssRules;
        } catch {
            continue;
        }
        for (const rule of Array.from(rules)) {
            if (rule.selectorText?.includes(':host') && /!important/i.test(rule.cssText)) {
                hostImportant.push(rule.selectorText);
            }
        }
    }
    return { parts, slots, hostImportant };
}

/**
 * Audits each custom element against a subset of the
 * [Gold Standard Checklist for Web Components](https://github.com/webcomponents/gold-standard/wiki)
 * plus documentation-coverage of its public surface. Combines manifest-derived
 * checks (documented events/parts/slots/attributes) with a JSDOM mount probe
 * (attribute↔property reflection, exposed parts/slots, un-overridable `:host`
 * styles). Returns one {@link LintResult} per element; rules are independent and
 * identified by a stable id.
 */
export async function lintManifest(files: string[], options: LintOptions = {}): Promise<LintResult[]> {
    const compilerOptions = options.compilerOptions ?? Compiler.DEFAULT_COMPILER_OPTIONS;
    const enabled = new Set(options.rules ?? LINT_RULES.map((r) => r.id));
    const pkg = new ManifestGenerator(files, compilerOptions).generate();
    const results: LintResult[] = [];

    for (const module of pkg.modules) {
        for (const decl of module.declarations) {
            if (!decl.tagName) continue;
            const issues: LintIssue[] = [];
            const warn = (rule: string, message: string): void => {
                if (enabled.has(rule)) issues.push({ rule, severity: 'warning', tagName: decl.tagName!, message });
            };

            try {
                const helper = new TestHelper();
                if (options.readyTimeout !== undefined) helper.readyTimeout = options.readyTimeout;
                const context = await helper.compileAndMountAsScript(decl.tagName, module.path, compilerOptions);
                const element = context.document.querySelector(decl.tagName);
                const shadow = (element as unknown as { shadowRoot?: DomShadowRoot | null })?.shadowRoot ?? null;

                // Probe the shadow *before* reflection mutates attributes (which may re-render it).
                const probe = shadow ? probeShadow(shadow) : { parts: new Set<string>(), slots: new Set<string>(), hostImportant: [] };

                runManifestRules(decl, probe, warn);

                if (enabled.has('reflection') && element) {
                    for (const issue of checkReflection(element as never, decl.attributes ?? [])) {
                        issues.push({ rule: 'reflection', severity: 'warning', tagName: decl.tagName, message: issue.message });
                    }
                }

                context.jsdom.window.close();
            } catch (error) {
                issues.push({
                    rule: 'mount',
                    severity: 'error',
                    tagName: decl.tagName,
                    message: `could not mount for linting: ${error instanceof Error ? error.message : String(error)}`,
                });
            }

            results.push({ tagName: decl.tagName, file: module.path, issues });
        }
    }
    return results;
}

/** The rules derivable from the manifest declaration + the shadow probe. */
function runManifestRules(decl: CustomElementDeclaration, probe: Probe, warn: (rule: string, message: string) => void): void {
    for (const selector of probe.hostImportant) {
        warn('host-overridable', `\`${selector}\` uses !important, which prevents consumers from overriding host styles`);
    }

    for (const event of decl.events ?? []) {
        if (!event.description) warn('undocumented-event', `event "${event.name}" is dispatched but not documented (@fires)`);
    }

    for (const attr of decl.attributes ?? []) {
        if (!attr.description) warn('undocumented-attribute', `attribute "${attr.name}" has no jsdoc description`);
    }

    const documentedParts = new Set((decl.cssParts ?? []).map((p) => p.name));
    for (const part of probe.parts) {
        if (!documentedParts.has(part)) warn('undocumented-part', `part="${part}" is exposed but not documented (@csspart)`);
    }

    const documentedSlots = new Set((decl.slots ?? []).map((s) => s.name ?? ''));
    for (const slot of probe.slots) {
        if (!documentedSlots.has(slot)) {
            warn('undocumented-slot', `a ${slot === '' ? 'default' : `"${slot}"`} slot is rendered but not documented (@slot)`);
        }
    }
}

/** Formats lint results as a human-readable report (rule id + message per finding). */
export function formatLintResults(results: LintResult[]): string {
    if (results.length === 0) return 'No custom elements found to lint.';
    const lines: string[] = [];
    let errors = 0;
    let warnings = 0;
    for (const result of results) {
        if (result.issues.length === 0) {
            lines.push(`OK   <${result.tagName}>`);
            continue;
        }
        lines.push(`<${result.tagName}>`);
        for (const issue of result.issues) {
            lines.push(`  ${issue.severity === 'error' ? 'error' : 'warn '} ${issue.rule}: ${issue.message}`);
            if (issue.severity === 'error') errors++;
            else warnings++;
        }
    }
    lines.push('', `${results.length} element(s), ${errors} error(s), ${warnings} warning(s)`);
    return lines.join('\n');
}
