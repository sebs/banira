import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TestHelper, MountContext } from 'banira';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const widgetPath = resolve(__dirname, '../src/wa-knob.ts');

describe('wa-knob attributes', () => {
    let mountContext: MountContext;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let widget: any;

    before(async () => {
        const helper = new TestHelper();
        mountContext = await helper.compileAndMountAsScript('wa-knob', widgetPath, undefined, {
            value: "20",
            min: "10",
            max: "30"
        });
        const { document } = mountContext;
        widget = document.querySelector('wa-knob')!;
    });

    after(() => {
        mountContext.jsdom.window.close();
    });

    it('value attribute', () => {
        assert.strictEqual(widget.getAttribute('value'), '20');
    });

    it('value property', () => {
        assert.strictEqual(widget.value, 20);
    })

    it('min attribute', () => {
        assert.strictEqual(widget.getAttribute('min'), '10');
    });

    it('min property', () => {
        assert.equal(widget.min, 10);
    });

    it('max attribute', () => {
        assert.strictEqual(widget.getAttribute('max'), '30');
    });

    it('max property', () => {
        assert.strictEqual(widget.max, 30);
    });

    it('default adheres to min and max', () => {
        assert.strictEqual(widget.getAttribute('default'), '10');
    });
});
