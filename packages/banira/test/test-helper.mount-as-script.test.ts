import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { TestHelper, MountContext } from '../src/test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const myCircleJs = readFileSync(resolve(__dirname, './fixtures/my-circle.js'), 'utf8');

describe('TestHelper', () => {
    
        var buildResult: MountContext;
        beforeEach(async () => {
            const helper = new TestHelper();
            buildResult = await helper.mountAsScript('my-circle', myCircleJs); 
        });

        afterEach(async () => {
            const { jsdom } = buildResult;
            jsdom.window.close();
        });

        it('returns a document', async() => {
            const { document } = buildResult;
            assert.ok(document);
        });

        it('should create a circle element', () => {
            const { document } = buildResult;
            const circle = document.querySelector('my-circle');
            assert.ok(circle, 'Circle element should exist');
            assert.strictEqual(circle?.tagName.toLowerCase(), 'my-circle');
        });
    
});




describe('TestHelper with attributes', () => {
    
    var buildResult: MountContext;
    beforeEach(async () => {
        const helper = new TestHelper();
        buildResult = await helper.mountAsScript('my-circle', myCircleJs, {'size': '20'}); 
    });

    afterEach(async () => {
        const { jsdom } = buildResult;
        jsdom.window.close();
    });

    it('returns a document', async() => {
        const { document } = buildResult;
        assert.ok(document);
    });

    it('should have 20 set as size', () => {
        const { document } = buildResult;
        const circle = document.querySelector('my-circle');
        assert.strictEqual(circle?.getAttribute('size'), '20');
    });

});