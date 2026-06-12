import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TestHelper, MountContext, Compiler, bundleModule } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const componentPath = resolve(__dirname, '../examples/my-circle/my-circle.ts');

describe('MyCircle Component', () => {
    let compiledCode: string;
    let mountContext: MountContext;

    let circleTag: Element;
    let shadowRoot: ShadowRoot;
    let svg: SVGSVGElement;
    let circleElement: SVGCircleElement;

    // Compiling is the expensive part; do it once. Mounting is cheap and the
    // tests mutate the element, so each test still gets a fresh mount.
    before(() => {
        compiledCode = bundleModule(componentPath, Compiler.DEFAULT_COMPILER_OPTIONS);
    });

    beforeEach(async () => {
        const helper = new TestHelper();
        mountContext = await helper.mountAsScript('my-circle', compiledCode);
        const { document } = mountContext;
        circleTag = document.querySelector('my-circle')!;
        shadowRoot = circleTag?.shadowRoot as ShadowRoot;
        svg = shadowRoot?.querySelector('svg') as SVGSVGElement;
        circleElement = svg?.querySelector('circle') as SVGCircleElement;
    });

    afterEach(() => {
        mountContext.jsdom.window.close();
    });

    it('should create a circle element', () => {
        assert.ok(circleTag, 'Circle element should exist');
        assert.strictEqual(circleTag?.tagName.toLowerCase(), 'my-circle');
    });

    it('should create a shadow root', () => {
        assert.ok(shadowRoot, 'Shadow root should exist');
    });

    it('should render an SVG circle', () => {
        assert.ok(svg, 'SVG element should exist');
        assert.ok(circleElement, 'Circle element should exist in SVG');
    });

    it('should update circle color when attribute changes', async () => {

        // Default color
        assert.strictEqual(
            circleElement?.getAttribute('fill'),
            'red',
            'Default color should be red'
        );

        // Change color
        circleTag?.setAttribute('color', 'blue');
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
