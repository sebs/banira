import type { CompilerOptions } from 'typescript';
import { Compiler } from './compiler.js';
import { ManifestGenerator } from './manifest.js';
import { TestHelper } from './test-helper.js';
import { checkReflection, checkSlots, type ReflectionIssue, type SlotIssue } from './smoke-checks.js';

export type { ReflectionIssue, SlotIssue } from './smoke-checks.js';

export interface SmokeResult {
    tagName: string;
    /** Source module the element is defined in. */
    file: string;
    ok: boolean;
    /** Failure reason when `ok` is false. */
    error?: string;
    /**
     * Attribute↔property reflection mismatches (#39). Present (possibly empty)
     * when the reflection check ran. Advisory: these don't flip `ok`.
     */
    reflection?: ReflectionIssue[];
    /**
     * Declared-vs-actual slot discrepancies (#40). Present (possibly empty) when
     * the slot check ran. Advisory: these don't flip `ok`.
     */
    slots?: SlotIssue[];
}

export interface SmokeOptions {
    compilerOptions?: CompilerOptions;
    /** Max ms to wait for each element to register (forwarded to TestHelper). */
    readyTimeout?: number;
    /** Also run the attribute↔property reflection round-trip and report mismatches (#39). */
    reflection?: boolean;
    /** Also assert declared `@slot`s project and flag undeclared shadow slots (#40). */
    slots?: boolean;
    /**
     * Strip script-reachable network APIs (XHR/WebSocket/fetch) from the mount
     * window so untrusted component code can't make outbound requests. Forwarded
     * to {@link TestHelper.blockNetwork}. See security-findings #1.
     */
    blockNetwork?: boolean;
    /**
     * Confine each component's bundled module graph to this directory (local
     * imports can't pull in out-of-tree source). Forwarded to
     * {@link TestHelper.confineToRoot}. See security-findings #22.
     */
    confineToRoot?: string;
}

/**
 * Manifest-driven smoke test: discovers every custom element in the given
 * sources via the manifest, then for each one compiles its module, mounts it in
 * JSDOM, and asserts the tag registers and upgrades to an `HTMLElement`
 * instance. Catches the most common breakages — a component that throws on
 * construction or never calls `customElements.define` — with no per-component
 * test code. Returns one {@link SmokeResult} per element.
 */
export async function smokeTestManifest(files: string[], options: SmokeOptions = {}): Promise<SmokeResult[]> {
    const compilerOptions = options.compilerOptions ?? Compiler.DEFAULT_COMPILER_OPTIONS;
    const generator = new ManifestGenerator(files, compilerOptions);
    const pkg = generator.generate();
    const results: SmokeResult[] = [];

    for (const module of pkg.modules) {
        for (const decl of module.declarations) {
            if (!decl.tagName) continue;
            const result: SmokeResult = { tagName: decl.tagName, file: module.path, ok: false };
            try {
                const helper = new TestHelper();
                if (options.readyTimeout !== undefined) helper.readyTimeout = options.readyTimeout;
                if (options.blockNetwork) helper.blockNetwork = true;
                if (options.confineToRoot) helper.confineToRoot = options.confineToRoot;
                const context = await helper.compileAndMountAsScript(decl.tagName, module.path, compilerOptions);
                const defined = context.window.customElements.get(decl.tagName);
                const element = context.document.querySelector(decl.tagName);
                if (!defined) {
                    result.error = `<${decl.tagName}> was never registered`;
                } else if (!(element instanceof context.window.HTMLElement)) {
                    result.error = `<${decl.tagName}> did not upgrade to an HTMLElement`;
                } else {
                    result.ok = true;
                    // Advisory checks run on the mounted (throwaway) element.
                    if (options.reflection) {
                        result.reflection = checkReflection(element as never, decl.attributes ?? []);
                    }
                    if (options.slots) {
                        result.slots = checkSlots(element as never, decl.slots ?? []);
                    }
                }
                context.jsdom.window.close();
            } catch (error) {
                result.error = error instanceof Error ? error.message : String(error);
            }
            results.push(result);
        }
    }

    return results;
}

/** Formats smoke results as a human-readable report, including advisory warnings. */
export function formatSmokeResults(results: SmokeResult[]): string {
    if (results.length === 0) return 'No custom elements found to smoke test.';
    const lines: string[] = [];
    for (const r of results) {
        lines.push(r.ok ? `PASS <${r.tagName}>` : `FAIL <${r.tagName}>  ${r.error ?? ''}`.trim());
        for (const issue of r.reflection ?? []) lines.push(`  warn reflection [${r.tagName}] ${issue.message}`);
        for (const issue of r.slots ?? []) lines.push(`  warn slot [${r.tagName}] ${issue.message}`);
    }
    const passed = results.filter((r) => r.ok).length;
    const warnings = results.reduce((n, r) => n + (r.reflection?.length ?? 0) + (r.slots?.length ?? 0), 0);
    lines.push('', `${passed}/${results.length} passed${warnings ? `, ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}`);
    return lines.join('\n');
}
