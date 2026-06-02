import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestHelper } from '../src/index.js';

describe('TestHelper.mountInBrowser', () => {
    it('throws a helpful error when Playwright is not installed', async () => {
        const helper = new TestHelper();
        await assert.rejects(
            () => helper.mountInBrowser('my-circle', 'customElements.define("my-circle", class extends HTMLElement {});'),
            /Playwright/
        );
    });
});
