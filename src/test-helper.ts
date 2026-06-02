import { JSDOM, ConstructorOptions } from 'jsdom';
import { CompilerOptions} from 'typescript';
import { DOMWindow } from 'jsdom';
import { Compiler } from './compiler.js';
import { VirtualCompilerHost } from './virtual-fs.js';
import { basename } from 'path';

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
}

/**
 * Helper class for testing web components in a JSDOM environment
 * 
 * @remarks
 * This class provides utilities for compiling TypeScript web components
 * and mounting them in a JSDOM environment for testing. It supports both
 * direct script mounting and compile-then-mount workflows.
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
    private jsdomOptions: ConstructorOptions = {
        url: "http://localhost",
        runScripts: "dangerously",
        resources: 'usable'
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
     * This method performs the following steps:
     * 1. Compiles the TypeScript file using the virtual filesystem
     * 2. Extracts the compiled JavaScript code
     * 3. Mounts the component in a JSDOM environment
     * 
     * @param tagName - The custom element tag name
     * @param fileName - Path to the TypeScript source file
     * @param compilerOptions - TypeScript compiler options
     * @param attributes - Optional key-value pairs of attributes to set on the mounted component
     * @returns Promise resolving to a {@link MountContext}
     * @throws Error if the compiler host is undefined
     */
    async compileAndMountAsScript(
        tagName: string, 
        fileName: string, 
        compilerOptions: CompilerOptions = Compiler.DEFAULT_COMPILER_OPTIONS,
        attributes?: Record<string, string>
    ): Promise<MountContext> {
        const compiler = await Compiler.withVirtualFs([fileName], compilerOptions);
        compiler.emit();
        const { host } = compiler;
        if (!host) {
            throw new Error('Host is undefined');
        }
        const outFile = `${compilerOptions.outDir}/${basename(fileName).replace(/\.ts$/, '.js')}`;
        const compiledCode = (host as VirtualCompilerHost).volume.readFileSync(outFile, 'utf8').toString();
        return this.mountAsScript(tagName, compiledCode, attributes);
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
        return { document, window, jsdom: dom};
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
        const page = await browser.newPage();
        await page.setContent(`<!DOCTYPE html><html><body><${tagName}></${tagName}></body></html>`);
        await page.addScriptTag({ content: code, type: 'module' });
        await page.waitForFunction((tag: string) => !!customElements.get(tag), tagName);
        return { page, browser, close: () => browser.close() };
    }
}
