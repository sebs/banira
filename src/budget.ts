import { createProgram, type CompilerOptions } from 'typescript';
import { gzipSync } from 'zlib';
import { performance } from 'perf_hooks';
import { Compiler } from './compiler.js';
import { ManifestGenerator } from './manifest.js';
import { TestHelper } from './test-helper.js';

/**
 * Bundle-size & render-cost budget (#45): measure what each component ships
 * and roughly how long it takes to render, persist that as a JSON baseline, and
 * fail CI when a later measurement regresses beyond a threshold.
 */

/** Measured cost of one custom element. */
export interface ComponentCost {
    tagName: string;
    /** Source module the element is defined in. */
    file: string;
    /** Bytes of emitted JavaScript for the module and its local import graph (lowered CSS/HTML included). */
    raw: number;
    /** Gzipped size of the same output — a proxy for transfer cost. */
    gzip: number;
    /**
     * Median ms to construct and connect a fresh instance (its first render) in
     * JSDOM. Rough: synchronous work only, and JSDOM is not a real browser.
     * Absent when render timing is disabled or the element failed to mount.
     */
    renderMs?: number;
    /** Why the render timing failed (the size is still reported). */
    error?: string;
}

export interface MeasureOptions {
    compilerOptions?: CompilerOptions;
    /** Also time the first render of each element (default true). */
    render?: boolean;
    /** Fresh instances timed per element; the median is reported (default 5). */
    samples?: number;
}

/** A persisted measurement to compare later runs against, keyed by tag name. */
export interface BudgetBaseline {
    components: Record<string, { raw: number; gzip: number; renderMs?: number }>;
}

export type BudgetMetric = 'raw' | 'gzip' | 'renderMs';

export interface BudgetViolation {
    tagName: string;
    metric: BudgetMetric;
    baseline: number;
    current: number;
}

export interface BudgetOptions {
    /** Allowed growth over the baseline as a fraction (default 0.1 = 10%). */
    threshold?: number;
    /**
     * Render-time regressions smaller than this many ms are ignored even when
     * over the threshold, since sub-millisecond JSDOM timings are noisy (default 1).
     */
    renderSlackMs?: number;
}

/**
 * Emits `entry` and its local import graph in memory with banira's compile
 * transformers (so lowered CSS/HTML imports count) and returns the JS outputs.
 * Bare (npm) imports are external and not included.
 */
function emitGraph(entry: string, compilerOptions: CompilerOptions): string[] {
    const options: CompilerOptions = {
        ...compilerOptions,
        sourceMap: false,
        inlineSourceMap: false,
        declaration: false,
        noEmit: false,
    };
    const { defaultTransformers } = new Compiler([entry], options);
    const outputs: string[] = [];
    createProgram([entry], options).emit(
        undefined,
        (fileName, data) => {
            if (/\.m?js$/.test(fileName)) outputs.push(data);
        },
        undefined,
        false,
        defaultTransformers
    );
    return outputs;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Mounts the element once, then times `samples` fresh instances being created and connected. */
async function timeFirstRender(
    tagName: string,
    file: string,
    compilerOptions: CompilerOptions,
    samples: number
): Promise<number> {
    const context = await new TestHelper().compileAndMountAsScript(tagName, file, compilerOptions);
    try {
        const { document } = context;
        // An unregistered tag would just create a plain element: no render to time.
        if (!context.window.customElements.get(tagName)) throw new Error(`<${tagName}> was never registered`);
        const times: number[] = [];
        for (let i = 0; i < samples; i++) {
            const start = performance.now();
            const el = document.createElement(tagName);
            document.body.appendChild(el);
            times.push(performance.now() - start);
            el.remove();
        }
        return Math.round(median(times) * 100) / 100;
    } finally {
        context.jsdom.window.close();
    }
}

/**
 * Measures every custom element found in `files` (via the manifest): the
 * emitted size of its module graph, raw and gzipped, and — unless disabled — a
 * rough first-render time from mounting it in JSDOM through {@link TestHelper}.
 */
export async function measureComponents(files: string[], options: MeasureOptions = {}): Promise<ComponentCost[]> {
    const compilerOptions = options.compilerOptions ?? Compiler.DEFAULT_COMPILER_OPTIONS;
    const samples = Math.max(1, options.samples ?? 5);
    const pkg = new ManifestGenerator(files, compilerOptions).generate();
    const costs: ComponentCost[] = [];

    for (const module of pkg.modules) {
        const tags = module.declarations.map((d) => d.tagName).filter((t): t is string => !!t);
        if (tags.length === 0) continue;
        const code = emitGraph(module.path, compilerOptions).join('\n');
        const raw = Buffer.byteLength(code);
        const gzip = gzipSync(code).length;

        for (const tagName of tags) {
            const cost: ComponentCost = { tagName, file: module.path, raw, gzip };
            if (options.render !== false) {
                try {
                    cost.renderMs = await timeFirstRender(tagName, module.path, compilerOptions, samples);
                } catch (error) {
                    cost.error = error instanceof Error ? error.message : String(error);
                }
            }
            costs.push(cost);
        }
    }
    return costs;
}

/** Turns a measurement into the JSON baseline persisted by `banira test --update-budget`. */
export function toBudgetBaseline(costs: ComponentCost[]): BudgetBaseline {
    const components: BudgetBaseline['components'] = {};
    for (const c of costs) {
        components[c.tagName] = { raw: c.raw, gzip: c.gzip, ...(c.renderMs !== undefined ? { renderMs: c.renderMs } : {}) };
    }
    return { components };
}

/**
 * Compares a measurement against a baseline and returns every metric that grew
 * beyond the threshold. Elements missing from the baseline (new) or from the
 * measurement (removed) are not violations.
 *
 * @throws Error if `baseline` is not a `{ components: { … } }` object.
 */
export function checkBudget(
    costs: ComponentCost[],
    baseline: BudgetBaseline,
    options: BudgetOptions = {}
): BudgetViolation[] {
    if (!baseline || typeof baseline.components !== 'object' || baseline.components === null) {
        throw new Error('checkBudget: the baseline is malformed (expected a { components: { … } } object).');
    }
    const threshold = options.threshold ?? 0.1;
    const slack = options.renderSlackMs ?? 1;
    const violations: BudgetViolation[] = [];

    for (const cost of costs) {
        const base = baseline.components[cost.tagName];
        if (!base) continue;
        for (const metric of ['raw', 'gzip', 'renderMs'] as const) {
            const before = base[metric];
            const now = cost[metric];
            if (typeof before !== 'number' || typeof now !== 'number') continue;
            if (now <= before * (1 + threshold)) continue;
            if (metric === 'renderMs' && now - before < slack) continue;
            violations.push({ tagName: cost.tagName, metric, baseline: before, current: now });
        }
    }
    return violations;
}

const unit = (metric: BudgetMetric, value: number): string => (metric === 'renderMs' ? `${value} ms` : `${value} B`);

/**
 * Formats a measurement as a human-readable report. When a baseline comparison
 * ran, pass its `violations` (and the baseline, to flag new elements) to append
 * the verdict.
 */
export function formatCosts(
    costs: ComponentCost[],
    budget?: { violations: BudgetViolation[]; baseline: BudgetBaseline; threshold?: number }
): string {
    if (costs.length === 0) return 'No custom elements found to measure.';
    const lines = costs.map((c) => {
        const render = c.renderMs !== undefined ? ` · first render ${c.renderMs} ms` : c.error ? ` · render failed: ${c.error}` : '';
        const isNew = budget && !budget.baseline.components[c.tagName] ? '  (new, not in baseline)' : '';
        return `SIZE <${c.tagName}>  ${c.raw} B raw · ${c.gzip} B gzip${render}${isNew}`;
    });
    if (budget) {
        const pct = Math.round((budget.threshold ?? 0.1) * 100);
        if (budget.violations.length === 0) {
            lines.push('', `Within budget (threshold ${pct}%).`);
        } else {
            lines.push('', `Budget exceeded (threshold ${pct}%):`);
            for (const v of budget.violations) {
                const growth = v.baseline > 0 ? ` (+${Math.round(((v.current - v.baseline) / v.baseline) * 1000) / 10}%)` : '';
                lines.push(`  FAIL <${v.tagName}> ${v.metric} ${unit(v.metric, v.baseline)} → ${unit(v.metric, v.current)}${growth}`);
            }
        }
    }
    return lines.join('\n');
}
