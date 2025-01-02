import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TestHelper, MountContext } from 'banira';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const widgetPath = resolve(__dirname, '../src/wa-knob.ts');

describe('wa-knob defaults', () => {
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

    it('should create a knob element', () => {
        assert.ok(widget);
    });

    it('initially value is the default', () => {
        assert.equal(widget.getAttribute('value'), '0');
    });

    it('initially min is the 0', () => {
        assert.equal(widget.getAttribute('min'), '0');
    });
    
    it('initially max is the 127', () => {
        assert.equal(widget.getAttribute('max'), '127');
    });
});
