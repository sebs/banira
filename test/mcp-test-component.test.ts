import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMcpServer } from '../src/mcp/index.js';
import type { IncomingMessage } from '../src/mcp/protocol.js';

const MY_CIRCLE = 'examples/my-circle/my-circle.ts';

function client(opts?: { readOnly?: boolean }) {
    const { handle } = createMcpServer(opts ?? {});
    let id = 0;
    const send = (method: string, params?: unknown): Promise<any> => {
        const msg: IncomingMessage = { jsonrpc: '2.0', method, id: ++id, ...(params !== undefined ? { params } : {}) };
        return handle(msg) as Promise<any>;
    };
    return {
        send,
        tool: async (name: string, args: Record<string, unknown>) =>
            (await send('tools/call', { name, arguments: args })).result,
        list: async (method: string) => (await send(method)).result,
    };
}

describe('mcp get_component_demo (milestone 4)', () => {
    let dir: string;
    before(() => {
        dir = mkdtempSync(join(tmpdir(), 'banira-mcp-demo-'));
        writeFileSync(join(dir, 'no-doc.ts'), 'export class NoDoc extends HTMLElement {}\n');
    });
    after(() => rmSync(dir, { recursive: true, force: true }));

    it('extracts @demo fenced code as structured { language, code } plus the summary', async () => {
        const c = client();
        const res = await c.tool('get_component_demo', { file: MY_CIRCLE, tagName: 'my-circle' });
        const sc = res.structuredContent;
        assert.strictEqual(sc.tagName, 'my-circle');
        assert.strictEqual(sc.demos.length, 1);
        assert.strictEqual(sc.demos[0].language, 'html');
        assert.match(sc.demos[0].code, /<my-circle/);
        assert.strictEqual(sc.summary, 'Resizable, recolourable SVG circle web component.');
    });

    it('returns an empty demo list (not an error) for a source without a doc comment', async () => {
        const c = client();
        const res = await c.tool('get_component_demo', { file: join(dir, 'no-doc.ts'), tagName: 'no-doc' });
        assert.notStrictEqual(res.isError, true);
        assert.deepStrictEqual(res.structuredContent.demos, []);
    });

    it('reports a missing file as a tool error', async () => {
        const c = client();
        const res = await c.tool('get_component_demo', { file: join(dir, 'nope.ts'), tagName: 'x-y' });
        assert.strictEqual(res.isError, true);
    });
});

describe('mcp test_component (milestone 4)', () => {
    it('manifest/smoke mode mounts in JSDOM and reports ok + summary', async () => {
        const c = client();
        const res = await c.tool('test_component', { files: [MY_CIRCLE] });
        const sc = res.structuredContent;
        assert.strictEqual(sc.engineUsed, 'jsdom');
        assert.strictEqual(sc.ok, true);
        assert.strictEqual(sc.components[0].tagName, 'my-circle');
        assert.strictEqual(sc.components[0].ok, true);
        assert.deepStrictEqual(sc.summary, { total: 1, passed: 1, failed: 0, warnings: 0 });
        assert.strictEqual(typeof sc.report, 'string');
    });

    it('single-component mode mounts one tag and runs shadow-piercing queries', async () => {
        const c = client();
        const res = await c.tool('test_component', { file: MY_CIRCLE, tagName: 'my-circle', query: ['circle'] });
        const sc = res.structuredContent;
        assert.strictEqual(sc.ok, true);
        assert.strictEqual(sc.engineUsed, 'jsdom');
        assert.deepStrictEqual(sc.queryResults, [{ selector: 'circle', matched: 1 }]);
    });

    it('reports ok:false when the tag never registers', async () => {
        const c = client();
        const res = await c.tool('test_component', { file: MY_CIRCLE, tagName: 'never-defined' });
        assert.strictEqual(res.structuredContent.ok, false);
    });

    it('engine:"browser" degrades to JSDOM with a reason when Playwright is absent', async () => {
        const c = client();
        const res = await c.tool('test_component', { file: MY_CIRCLE, tagName: 'my-circle', engine: 'browser' });
        const sc = res.structuredContent;
        assert.strictEqual(sc.engineUsed, 'jsdom');
        assert.strictEqual(sc.ok, true);
        assert.deepStrictEqual(sc.degraded, { browserRequested: true, ran: 'jsdom', reason: 'playwright-not-installed' });
    });

    it('requires either files or file+tagName', async () => {
        const c = client();
        const res = await c.tool('test_component', {});
        assert.strictEqual(res.isError, true);
        assert.match(res.content[0].text, /Provide either/);
    });

    it('registers get_component_demo and test_component in read-only mode', async () => {
        const ro = client({ readOnly: true });
        const names = (await ro.list('tools/list')).tools.map((t: any) => t.name);
        assert.ok(names.includes('get_component_demo'));
        assert.ok(names.includes('test_component'));
    });
});
