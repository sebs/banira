import { JSDOM, ConstructorOptions } from 'jsdom';
import { Volume } from 'memfs';
import { CompilerOptions} from 'typescript';
import { createVirtualCompilerHost } from './virtual-fs.js';
import { DOMWindow } from 'jsdom';
import { Compiler } from './compiler.js';
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
     * @returns Promise resolving to a {@link MountContext}
     * @throws Error if the compiler host is undefined
     */
    async compileAndMountAsScript(tagName: string, fileName: string, compilerOptions: CompilerOptions): Promise<MountContext> {
        const compiler = await Compiler.withVirtualFs([fileName], compilerOptions);
        compiler.emit();
        const { host } = compiler as any;
        if (!host) {
            throw new Error('Host is undefined');
        }
        const outFile = `/dist/${basename(fileName).replace('.ts', '.js')}`;
        const compiledCode = host.volume.readFileSync(outFile, 'utf8');
        return this.mountAsScript(tagName, compiledCode);
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
     * @returns Promise resolving to a {@link MountContext}
     */
    async mountAsScript(tagName: string, code: string): Promise<MountContext> {
        const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Test Page</title>
                </head>
                <body>
                    <${tagName}></${tagName}>
                </body>
            </html>
        `, this.jsdomOptions);

        const { window } = dom;
        const { document } = window;

        const scriptElement = document.createElement('script');
        scriptElement.textContent = code;
        document.head.appendChild(scriptElement);
        await new Promise(resolve => setTimeout(resolve, 100));
        return { document, window, jsdom: dom};
    }
}
