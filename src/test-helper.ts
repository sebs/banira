import { JSDOM, ConstructorOptions } from 'jsdom';
import { CompilerOptions} from 'typescript';
import { DOMWindow } from 'jsdom';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { Compiler } from './compiler.js';
import { bundleModule } from './module-bundler.js';
import {
    summarizeA11y,
    resolveBaselinePath,
    actualPathFor,
    buffersEqual,
    type A11yResult,
    type RawAxeResults,
    type ScreenshotResult,
} from './browser-testing.js';

/**
 * Interface representing the context after mounting a component in JSDOM
 * 
 * @interface MountContext
 * @property {Document} document - The JSDOM document object
 * @property {DOMWindow} window - The JSDOM window object
 * @property {JSDOM} jsdom - The JSDOM instance
 */
export interface MountContext {
    document: Document;
    window: DOMWindow;
    jsdom: JSDOM;
    /**
     * Shadow-piercing `querySelector`: returns the first element matching
     * `selector` anywhere in the mounted tree, descending into open shadow roots
     * — so tests need not hand-walk `shadowRoot`. Returns `null` if none match.
     */
    query(selector: string): Element | null;
    /** Shadow-piercing `querySelectorAll`: every match across open shadow boundaries, in document order. */
    queryAll(selector: string): Element[];
}

/** Collects all elements matching `selector`, descending into open shadow roots. */
function deepQueryAll(root: Document | ShadowRoot | Element, selector: string): Element[] {
    const out: Element[] = [];
    const visit = (node: Document | ShadowRoot | Element): void => {
        out.push(...Array.from(node.querySelectorAll(selector)));
        for (const el of Array.from(node.querySelectorAll('*'))) {
            const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
            if (shadow) visit(shadow);
        }
    };
    visit(root);
    return out;
}

/**
 * Handle returned by {@link TestHelper.mountInBrowser}: the Playwright page and
 * browser, plus a `close()` to tear them down. Typed loosely because Playwright
 * is an optional peer dependency.
 */
export interface BrowserMountContext {
    page: { waitForFunction: (fn: string, arg?: unknown) => Promise<unknown>; [key: string]: unknown };
    browser: { close: () => Promise<void>; [key: string]: unknown };
    close: () => Promise<void>;
    /**
     * Runs axe-core against the mounted component and returns its violations
     * (#14). axe-core is an optional dependency (`npm i -D axe-core`). It can only
     * traverse **open** shadow roots, so components under a11y test must use
     * `attachShadow({ mode: 'open' })`.
     */
    checkAccessibility: (options?: A11yOptions) => Promise<A11yResult>;
    /**
     * Captures a PNG screenshot of the mounted element (or the full page) and
     * returns the buffer (#15).
     */
    screenshot: (options?: ScreenshotOptions) => Promise<Buffer>;
    /**
     * Visual-snapshot assertion (#15): compares a screenshot of the mounted
     * element against an on-disk baseline, creating the baseline on first run.
     * For perceptual/tolerant diffing, use Playwright's own `toHaveScreenshot`
     * on the exposed {@link BrowserMountContext.page}.
     */
    matchScreenshot: (name: string, options?: MatchScreenshotOptions) => Promise<ScreenshotResult>;
}

export interface A11yOptions {
    /** axe-core run options forwarded to `axe.run` (e.g. `{ runOnly: ['wcag2a'] }`). */
    axeOptions?: Record<string, unknown>;
}

export interface ScreenshotOptions {
    /** CSS selector to screenshot (defaults to the mounted tag). */
    selector?: string;
    /** Screenshot the whole page instead of a single element. */
    fullPage?: boolean;
}

export interface MatchScreenshotOptions extends ScreenshotOptions {
    /** Directory baselines live in (default `__screenshots__`). */
    baselineDir?: string;
    /** Overwrite the baseline with the current screenshot instead of comparing. */
    update?: boolean;
}

/**
 * Helper class for testing web components in a JSDOM environment
 * 
 * @remarks
 * This class provides utilities for compiling TypeScript web components
 * and mounting them in a JSDOM environment for testing. It supports both
 * direct script mounting and compile-then-mount workflows.
 *
 * Mounting runs the component's code (jsdom is configured with
 * `runScripts: "dangerously"` — required for custom elements to register and
 * upgrade). Only mount code you trust, i.e. your own components under test;
 * never feed untrusted third-party source through the helper.
 *
 * @example
 * ```typescript
 * // Mount a pre-compiled component
 * const helper = new TestHelper();
 * const context = await helper.mountAsScript('my-component', compiledCode);
 * const element = context.document.querySelector('my-component');
 * 
 * // Compile and mount a TypeScript component
 * const context = await helper.compileAndMountAsScript(
 *   'my-component',
 *   'src/my-component.ts',
 *   { target: 'ES2015' }
 * );
 * ```
 */
export class TestHelper {
    /**
     * Default JSDOM options for component testing
     * @private
     */
    // `runScripts: "dangerously"` is required to execute the injected component
    // script (it's inline, so it runs regardless of `resources`). `resources` is
    // deliberately left at the default (do NOT fetch external <script>/<link>/<img>)
    // so mounting a component can't make outbound requests (SSRF). Pass
    // `{ resources: 'usable' }` to the constructor to opt back in. See security-findings #5.
    private jsdomOptions: ConstructorOptions = {
        url: "http://localhost",
        runScripts: "dangerously"
    };

    /**
     * Upper bound (ms) for waiting on a custom element to be defined before
     * giving up, so a component that never registers fails fast instead of
     * hanging. Resolution happens as soon as the element is defined.
     */
    public readyTimeout: number = 1000;

    /**
     * Creates a new TestHelper instance
     *
     * @param options - Optional JSDOM constructor options to override defaults
     */
    constructor(options?: ConstructorOptions) {
        this.jsdomOptions = { ...this.jsdomOptions, ...options }
    }

    /**
     * Compiles a TypeScript component and mounts it in a JSDOM environment
     * 
     * @remarks
     * Compiles the file **and its local import graph** into a single
     * self-contained classic script (see {@link bundleModule}) and mounts it, so
     * components that import sibling modules work — not just single-file ones.
     *
     * @param tagName - The custom element tag name
     * @param fileName - Path to the TypeScript source file
     * @param compilerOptions - TypeScript compiler options
     * @param attributes - Optional key-value pairs of attributes to set on the mounted component
     * @returns Promise resolving to a {@link MountContext}
     */
    async compileAndMountAsScript(
        tagName: string,
        fileName: string,
        compilerOptions: CompilerOptions = Compiler.DEFAULT_COMPILER_OPTIONS,
        attributes?: Record<string, string>
    ): Promise<MountContext> {
        const code = bundleModule(fileName, compilerOptions);
        return this.mountAsScript(tagName, code, attributes);
    }

    /**
     * Mounts a pre-compiled component in a JSDOM environment
     * 
     * @remarks
     * This method creates a new JSDOM instance with a basic HTML structure,
     * adds the component's tag to the body, and injects the component's code
     * as a script. It waits for a short period to allow for component initialization.
     * 
     * @param tagName - The custom element tag name
     * @param code - The compiled JavaScript code for the component
     * @param attributes - Optional key-value pairs of attributes to set on the mounted component
     * @returns Promise resolving to a {@link MountContext}
     */
    async mountAsScript(tagName: string, code: string, attributes?: Record<string, string>): Promise<MountContext> {
        const defaultAttributes = {};

        const mergedAttributes = { ...defaultAttributes, ...attributes };
        const attributeString = Object.entries(mergedAttributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');

        const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Test Page</title>
                </head>
                <body>
                    <${tagName} ${attributeString}></${tagName}>
                </body>
            </html>
        `, this.jsdomOptions);

        const { window } = dom;
        const { document } = window;

        const scriptElement = document.createElement('script');
        scriptElement.textContent = code;
        document.head.appendChild(scriptElement);
        await this.waitForDefined(window, tagName);
        const queryAll = (selector: string): Element[] => deepQueryAll(document, selector);
        const query = (selector: string): Element | null => queryAll(selector)[0] ?? null;
        return { document, window, jsdom: dom, query, queryAll };
    }

    /**
     * Waits until the custom element is registered, rather than guessing with a
     * fixed delay. Defining an element synchronously upgrades already-present
     * instances, so a microtask/timer flush afterwards lets their lifecycle
     * callbacks settle. Bounded by {@link readyTimeout} so a script that never
     * defines the element fails the assertion instead of hanging forever.
     */
    private async waitForDefined(window: DOMWindow, tagName: string): Promise<void> {
        await Promise.race([
            window.customElements.whenDefined(tagName),
            new Promise<void>(resolve => window.setTimeout(resolve, this.readyTimeout)),
        ]);
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }

    /**
     * Mounts a compiled component in a real browser via Playwright, for
     * higher-fidelity testing than JSDOM (layout, real CSS, true custom-element
     * semantics). Playwright is an optional peer dependency — install it with
     * `npm i -D playwright` and `npx playwright install chromium`.
     *
     * @param tagName - The custom element tag name
     * @param code - The compiled JavaScript (injected as a module script, so
     *   components with imports/exports work)
     * @returns A {@link BrowserMountContext}; call `close()` when done
     * @throws Error if Playwright is not installed
     */
    async mountInBrowser(tagName: string, code: string): Promise<BrowserMountContext> {
        // A non-literal specifier keeps TypeScript from resolving (and requiring)
        // the optional dependency at build time.
        const specifier: string = 'playwright';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let playwright: any;
        try {
            playwright = await import(specifier);
        } catch {
            throw new Error(
                'Real-browser testing requires Playwright. Install it with `npm i -D playwright` and `npx playwright install chromium`.'
            );
        }

        const browser = await playwright.chromium.launch();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let page: any;
        try {
            page = await browser.newPage();
            await page.setContent(`<!DOCTYPE html><html><body><${tagName}></${tagName}></body></html>`);
            await page.addScriptTag({ content: code, type: 'module' });
            await page.waitForFunction((tag: string) => !!customElements.get(tag), tagName);
        } catch (error) {
            // Tear Chromium down if setup fails (e.g. the component never registers,
            // so waitForFunction times out) — a rejected mount must not leak a
            // headless browser process.
            await browser.close();
            throw error;
        }

        const checkAccessibility = async (options?: A11yOptions): Promise<A11yResult> => {
            // axe-core ships its full browser bundle as a string on `.source`.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let axe: any;
            try {
                const axeSpecifier: string = 'axe-core';
                axe = await import(axeSpecifier);
            } catch {
                throw new Error(
                    'Accessibility testing requires axe-core. Install it with `npm i -D axe-core`.'
                );
            }
            const source: string = axe.source ?? axe.default?.source;
            await page.addScriptTag({ content: source });
            // axe traverses only OPEN shadow roots; closed roots are invisible to it.
            const raw = (await page.evaluate(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (opts: Record<string, unknown>) => (globalThis as any).axe.run(document, opts),
                options?.axeOptions ?? {}
            )) as RawAxeResults;
            return summarizeA11y(raw);
        };

        const screenshot = async (options?: ScreenshotOptions): Promise<Buffer> => {
            if (options?.fullPage) return (await page.screenshot({ fullPage: true })) as Buffer;
            const target = await page.$(options?.selector ?? tagName);
            if (!target) throw new Error(`No element matched "${options?.selector ?? tagName}" to screenshot`);
            return (await target.screenshot()) as Buffer;
        };

        const matchScreenshot = async (
            name: string,
            options?: MatchScreenshotOptions
        ): Promise<ScreenshotResult> => {
            const dir = options?.baselineDir ?? '__screenshots__';
            const baselinePath = resolveBaselinePath(dir, name);
            const current = await screenshot(options);
            if (options?.update || !existsSync(baselinePath)) {
                mkdirSync(dirname(baselinePath), { recursive: true });
                writeFileSync(baselinePath, current);
                return { matched: true, created: !options?.update, baselinePath };
            }
            const expected = readFileSync(baselinePath);
            if (buffersEqual(expected, current)) {
                return { matched: true, created: false, baselinePath };
            }
            const actualPath = actualPathFor(baselinePath);
            writeFileSync(actualPath, current);
            return { matched: false, created: false, baselinePath, actualPath };
        };

        return { page, browser, close: () => browser.close(), checkAccessibility, screenshot, matchScreenshot };
    }
}
