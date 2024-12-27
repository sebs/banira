import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { TestHelper, MountContext } from 'vanillin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const componentPath = resolve(__dirname, '../dist/my-circle.js');
const componentCode = readFileSync(componentPath, 'utf-8');

describe('MyCircle Component', () => {
    let mountContext: MountContext;

    beforeEach(async () => {
        const helper = new TestHelper();
        mountContext = await helper.mountAsScript('my-circle', componentCode);
    });

    afterEach(() => {
        mountContext.jsdom.window.close();
    });

    it('should create a circle element', () => {
        const { document } = mountContext;
        const circle = document.querySelector('my-circle');
        assert.ok(circle, 'Circle element should exist');
        assert.strictEqual(circle?.tagName.toLowerCase(), 'my-circle');
    });

    it('should create a shadow root', () => {
        const { document } = mountContext;
        const circle = document.querySelector('my-circle');
        const shadowRoot = circle?.shadowRoot;
        assert.ok(shadowRoot, 'Shadow root should exist');
    });

    it('should render an SVG circle', () => {
        const { document } = mountContext;
        const circle = document.querySelector('my-circle');
        const shadowRoot = circle?.shadowRoot;
        const svg = shadowRoot?.querySelector('svg');
        const circleElement = svg?.querySelector('circle');
        
        assert.ok(svg, 'SVG element should exist');
        assert.ok(circleElement, 'Circle element should exist in SVG');
    });

    it('should update circle color when attribute changes', async () => {
        const { document } = mountContext;
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
        await new Promise(resolve => setTimeout(resolve, 200));

        const svgCircle2 = shadowRoot?.querySelector('circle');
        assert.strictEqual(
            svgCircle2?.getAttribute('fill'),
            'blue',
            'Color should update to blue'
        );
    });

    it('should update circle size when attribute changes', async () => {
        const { document } = mountContext;
        const circle = document.querySelector('my-circle');
        const shadowRoot = circle?.shadowRoot;
        const svg = shadowRoot?.querySelector('svg');

        // Default size
        assert.strictEqual(
            svg?.getAttribute('width'),
            '100',
            'Default width should be 100'
        );

        // Change size
        circle?.setAttribute('size', '75');
        await new Promise(resolve => setTimeout(resolve, 200));

        const svg2 = shadowRoot?.querySelector('svg');
        assert.strictEqual(
            svg2?.getAttribute('width'),
            '150',
            'Width should update to 150'
        );
    });
});
