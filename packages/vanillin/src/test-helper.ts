import { JSDOM, ConstructorOptions } from 'jsdom';
import { Volume } from 'memfs';
import * as ts from 'typescript';
import { createVirtualCompilerHost } from './virtual-fs.js';
import { DOMWindow } from 'jsdom';

export interface MountContext {
    document: Document;
    window: DOMWindow;
    jsdom: JSDOM;
}

export class TestHelper {
    private jsdomOptions: ConstructorOptions = {
        url: "http://localhost",
        runScripts: "dangerously",
        resources: 'usable'
    };

    constructor(options?: ConstructorOptions) {
        this.jsdomOptions = { ...this.jsdomOptions, ...options }
    }

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
