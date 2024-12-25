import { describe, it, beforeEach, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('MyCircle Component', () => {
    let dom: JSDOM;
    let document: Document;
    let window: Window;

    beforeEach(() => {
        // Create a new JSDOM instance for each test
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Test Page</title>
                </head>
                <body>
                    <my-circle></my-circle>
                </body>
            </html>
        `, {
            url: 'http://localhost',
            runScripts: 'dangerously',
            resources: 'usable'
        });

        // https://github.com/cure53/DOMPurify/issues/437#issuecomment-632021941
        window = dom.window as unknown as Window;
        document = window.document;

        // Load the component script
        const componentPath = resolve(__dirname, '../dist/index.js');
        // console.log('Loading component from:', componentPath);
        const componentScript = readFileSync(componentPath, 'utf-8');
        // console.log('Component script:', componentScript);

        // Add the script to the document
        const scriptElement = document.createElement('script');
        scriptElement.textContent = componentScript;
        document.head.appendChild(scriptElement);

        // Wait for the script to load
        return new Promise(resolve => setTimeout(resolve, 100));
    });

    afterEach(() => {
        // Clean up
        dom.window.close();
    });

    it('should create a circle element', () => {
        const circle = document.querySelector('my-circle');
        assert.ok(circle, 'Circle element should exist');
        assert.strictEqual(circle?.tagName.toLowerCase(), 'my-circle');
    });

    it('should create a shadow root', () => {
        const circle = document.querySelector('my-circle');
        const shadowRoot = circle?.shadowRoot;
        assert.ok(shadowRoot, 'Shadow root should exist');
    });

    it('should render an SVG circle', () => {
        const circle = document.querySelector('my-circle');
        const shadowRoot = circle?.shadowRoot;
        const svg = shadowRoot?.querySelector('svg');
        const circleElement = svg?.querySelector('circle');
        
        assert.ok(svg, 'SVG element should exist');
        assert.ok(circleElement, 'Circle element should exist in SVG');
    });

    it('should update circle color when attribute changes', async () => {
        const circle = document.querySelector('my-circle');
        const shadowRoot = circle?.shadowRoot;
        const svgCircle = shadowRoot?.querySelector('circle');

        // Default color
        assert.strictEqual(
            svgCircle?.getAttribute('fill'),
            'red',
            'Default color should be red'
        );

        // Change color
        circle?.setAttribute('color', 'blue');
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait longer

        const svgCircle2 = shadowRoot?.querySelector('circle');
        assert.strictEqual(
            svgCircle2?.getAttribute('fill'),
            'blue',
            'Color should update to blue'
        );
    });

    it('should update circle size when attribute changes', async () => {
        const circle = document.querySelector('my-circle');
        const shadowRoot = circle?.shadowRoot;
        const svgCircle = shadowRoot?.querySelector('circle');

        // Default size
        assert.strictEqual(
            svgCircle?.getAttribute('r'),
            '50',
            'Default radius should be 50'
        );

        // Change size
        circle?.setAttribute('size', '75');
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait longer
        const svgCircle2 = shadowRoot?.querySelector('circle');
        assert.strictEqual(
            svgCircle2?.getAttribute('r'),
            '75',
            'Radius should update to 75'
        );
    });
});
