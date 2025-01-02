import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { TestHelper, MountContext } from '../src/test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const myCircleJs = readFileSync(resolve(__dirname, './fixtures/my-circle.js'), 'utf8');

describe('TestHelper.compileAndMountAsScript', () => {
    
        var buildResult: MountContext;
        beforeEach(async () => {
            const helper = new TestHelper();
            helper.compileAndMountAsScript('my-circle', resolve(__dirname, './fixtures/my-circle.ts'));
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

       
    
});
