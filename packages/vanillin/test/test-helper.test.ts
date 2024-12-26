import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { TestHelper, MountContext } from '../src/test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('TestHelper', () => {
    describe('JS moddule', () => {
        var document: Document;
        beforeEach(async () => {
            const simpleJs = readFileSync(resolve(__dirname, './fixtures/simple.js'), 'utf8');
            const helper = new TestHelper();
            const buildResult = await helper.mountAsScript('script', simpleJs);
            document = buildResult.document;
        });

        it('returns a document', async() => {
            assert.ok(document);
        });
    });

    describe('Simple web component', () => {
        var buildResult: MountContext;
        beforeEach(async () => {
            const simpleJs = readFileSync(resolve(__dirname, './fixtures/my-circle.js'), 'utf8');
            const helper = new TestHelper();
            buildResult = await helper.mountAsScript('my-circle', simpleJs); 
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
    
});
