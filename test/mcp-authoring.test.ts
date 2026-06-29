import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMcpServer } from '../src/mcp/index.js';
import type { IncomingMessage } from '../src/mcp/protocol.js';

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

describe('mcp authoring tools + resource (milestone 3)', () => {
    it('get_authoring_guidelines returns the source-derived tag contract and per-variant examples', async () => {
        const c = client();
        const res = await c.tool('get_authoring_guidelines', {});
        const g = res.structuredContent;
        assert.ok(Array.isArray(g.tags) && g.tags.length >= 8);
        assert.ok(g.tags.some((t: any) => t.tag === '@fires'));
        assert.ok(g.tags.some((t: any) => t.tag === '@demo'));
        assert.match(g.namingRule, /hyphen/);
        assert.deepStrictEqual(Object.keys(g.examples).sort(), ['aria', 'formAssociated', 'hydrate', 'plain']);
        for (const src of Object.values(g.examples) as string[]) {
            assert.ok(src.includes('HTMLElement'), 'each example should be a real component');
        }
    });

    it('get_authoring_guidelines can scope the example to one variant', async () => {
        const c = client();
        const res = await c.tool('get_authoring_guidelines', { variant: 'aria' });
        assert.deepStrictEqual(Object.keys(res.structuredContent.examples), ['aria']);
    });

    it('scaffold_component returns the starter files in memory', async () => {
        const c = client();
        const res = await c.tool('scaffold_component', { tagName: 'my-widget' });
        const paths = res.structuredContent.files.map((f: any) => f.path);
        assert.deepStrictEqual(paths.sort(), ['index.html', 'my-widget.ts']);
        assert.strictEqual(res.structuredContent.variant, 'plain');

        const fa = await c.tool('scaffold_component', { tagName: 'my-toggle', variant: 'form-associated' });
        const tsFile = fa.structuredContent.files.find((f: any) => f.path.endsWith('.ts'));
        assert.match(tsFile.content, /formAssociated/);
    });

    it('an invalid tag name is a tool error (isError), not a crash', async () => {
        const c = client();
        const res = await c.tool('scaffold_component', { tagName: 'BadName' });
        assert.strictEqual(res.isError, true);
        assert.match(res.content[0].text, /valid custom element name/);
    });

    describe('writing to disk', () => {
        let dir: string;
        before(() => {
            dir = mkdtempSync(join(tmpdir(), 'banira-mcp-scaffold-'));
        });
        after(() => {
            rmSync(dir, { recursive: true, force: true });
        });

        it('writes files with write:true and refuses to clobber without force', async () => {
            const c = client();
            const first = await c.tool('scaffold_component', { tagName: 'w-one', write: true, dir });
            assert.deepStrictEqual(
                first.structuredContent.written.map((p: string) => p.split('/').pop()).sort(),
                ['index.html', 'w-one.ts']
            );
            assert.ok(existsSync(join(dir, 'w-one.ts')));
            assert.ok(existsSync(join(dir, 'index.html')));

            const clobber = await c.tool('scaffold_component', { tagName: 'w-one', write: true, dir });
            assert.strictEqual(clobber.isError, true);
            assert.match(clobber.content[0].text, /Refusing to overwrite/);

            const forced = await c.tool('scaffold_component', { tagName: 'w-one', write: true, dir, force: true });
            assert.strictEqual(forced.structuredContent.written.length, 2);
        });
    });

    it('omits scaffold_component in read-only mode but keeps get_authoring_guidelines', async () => {
        const ro = client({ readOnly: true });
        const names = (await ro.list('tools/list')).tools.map((t: any) => t.name);
        assert.ok(!names.includes('scaffold_component'), 'scaffold_component must be unregistered in read-only');
        assert.ok(names.includes('get_authoring_guidelines'));
    });

    it('exposes the authoring-guide resource and reads it as Markdown', async () => {
        const c = client();
        const uris = (await c.list('resources/list')).resources.map((r: any) => r.uri);
        assert.ok(uris.includes('resource://banira/authoring-guide'));

        const read = await c.send('resources/read', { uri: 'resource://banira/authoring-guide' });
        assert.strictEqual(read.result.contents[0].mimeType, 'text/markdown');
        assert.match(read.result.contents[0].text, /^# banira authoring guidelines/);

        const unknown = await c.send('resources/read', { uri: 'resource://banira/does-not-exist' });
        assert.strictEqual(unknown.error.code, -32002);
    });
});
