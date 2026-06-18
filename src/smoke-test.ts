import type { CompilerOptions } from 'typescript';
import { Compiler } from './compiler.js';
import { ManifestGenerator } from './manifest.js';
import { TestHelper } from './test-helper.js';

export interface SmokeResult {
    tagName: string;
    /** Source module the element is defined in. */
    file: string;
    ok: boolean;
    /** Failure reason when `ok` is false. */
    error?: string;
}

export interface SmokeOptions {
    compilerOptions?: CompilerOptions;
    /** Max ms to wait for each element to register (forwarded to TestHelper). */
    readyTimeout?: number;
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
                const context = await helper.compileAndMountAsScript(decl.tagName, module.path, compilerOptions);
                const defined = context.window.customElements.get(decl.tagName);
                const element = context.document.querySelector(decl.tagName);
                if (!defined) {
                    result.error = `<${decl.tagName}> was never registered`;
                } else if (!(element instanceof context.window.HTMLElement)) {
                    result.error = `<${decl.tagName}> did not upgrade to an HTMLElement`;
                } else {
                    result.ok = true;
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

/** Formats smoke results as a human-readable report. */
export function formatSmokeResults(results: SmokeResult[]): string {
    if (results.length === 0) return 'No custom elements found to smoke test.';
    const lines = results.map((r) => (r.ok ? `PASS <${r.tagName}>` : `FAIL <${r.tagName}>  ${r.error ?? ''}`.trim()));
    const passed = results.filter((r) => r.ok).length;
    lines.push('', `${passed}/${results.length} passed`);
    return lines.join('\n');
}
