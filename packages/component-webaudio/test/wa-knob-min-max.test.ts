import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TestHelper, MountContext } from 'vanillin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const widgetPath = resolve(__dirname, '../src/wa-knob.ts');

describe('wa-knob min/max', () => {
    let mountContext: MountContext;
    let widget: HTMLElement;

    before(async () => {
        const helper = new TestHelper();
        mountContext = await helper.compileAndMountAsScript('wa-knob', widgetPath);
        const { document } = mountContext;
        widget = document.querySelector('wa-knob')!;
    });

    after(() => {
        mountContext.jsdom.window.close();
    });

    it('setting below min  gets you a result of min', () => {
        widget.setAttribute('value', '-1');
        const value = widget.getAttribute('value');
        assert.strictEqual(value, '0');
    });

    it('setting above max  gets you a result of max', () => {
        widget.setAttribute('value', '200');
        const value = widget.getAttribute('value');
        assert.strictEqual(value, '127');
    });

    it('you can set max', () => {
        widget.setAttribute('max', '200');
        widget.setAttribute('value', '200');
        const value = widget.getAttribute('value');
        assert.strictEqual(value, '200');
    });
});
