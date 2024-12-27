import { JSDOM, ConstructorOptions } from 'jsdom';
import { Volume } from 'memfs';
import { CompilerOptions} from 'typescript';
import { createVirtualCompilerHost } from './virtual-fs.js';
import { DOMWindow } from 'jsdom';
import { Compiler } from './compiler.js';
import { basename } from 'path';

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
