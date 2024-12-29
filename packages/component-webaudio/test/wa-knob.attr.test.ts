import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TestHelper, MountContext } from 'vanillin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const widgetPath = resolve(__dirname, '../src/wa-knob.ts');

describe('set value', () => {
    let mountContext: MountContext;
    let widget: HTMLElement;

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

    it('gets the right value', () => {
        assert.strictEqual(widget.getAttribute('value'), '20');
    });

    it('gets the right min', () => {
        assert.strictEqual(widget.getAttribute('min'), '10');
    });

    it('gets the right max', () => {
        assert.strictEqual(widget.getAttribute('max'), '30');
    });
});
