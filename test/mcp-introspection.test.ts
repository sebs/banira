import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createMcpServer } from '../src/mcp/index.js';
import type { IncomingMessage } from '../src/mcp/protocol.js';

const MY_CIRCLE = 'examples/my-circle/my-circle.ts';

function server(opts?: { readOnly?: boolean }) {
    const { handle } = createMcpServer(opts ?? {});
    let id = 0;
    const send = (method: string, params?: unknown): Promise<any> => {
        const msg: IncomingMessage = { jsonrpc: '2.0', method, id: ++id, ...(params !== undefined ? { params } : {}) };
        return handle(msg) as Promise<any>;
    };
    const callTool = async (name: string, args: Record<string, unknown>): Promise<any> => {
        const res = await send('tools/call', { name, arguments: args });
        return res.result;
    };
    return { send, callTool };
}

describe('mcp introspection tools (milestone 1)', () => {
    it('registers the three Group 1 tools in both full and read-only mode', async () => {
        for (const opts of [{}, { readOnly: true }]) {
            const { send } = server(opts);
            const res = await send('tools/list');
            const names = res.result.tools.map((t: any) => t.name);
            for (const expected of ['get_component_manifest', 'get_component_api', 'list_components']) {
                assert.ok(names.includes(expected), `expected ${expected} in ${JSON.stringify(names)}`);
            }
            for (const name of ['get_component_manifest', 'get_component_api', 'list_components']) {
                const t = res.result.tools.find((x: any) => x.name === name);
                assert.strictEqual(t.inputSchema.type, 'object');
                assert.strictEqual(t.annotations.readOnlyHint, true);
            }
        }
    });

    it('get_component_manifest returns the CEM with the tag, and mirrors JSON into a text block', async () => {
        const { callTool } = server();
        const res = await callTool('get_component_manifest', { files: [MY_CIRCLE] });
        assert.notStrictEqual(res.isError, true);
        assert.strictEqual(res.structuredContent.schemaVersion, '2.1.0');
        const decl = res.structuredContent.modules[0].declarations[0];
        assert.strictEqual(decl.tagName, 'my-circle');
        assert.strictEqual(decl.name, 'MyCircle');
        // The text content block mirrors the structured JSON (MCP backwards-compat rule).
        assert.strictEqual(res.content[0].type, 'text');
        assert.deepStrictEqual(JSON.parse(res.content[0].text), res.structuredContent);
    });

    it('get_component_manifest can also emit a Markdown rendering', async () => {
        const { callTool } = server();
        const res = await callTool('get_component_manifest', { files: [MY_CIRCLE], markdown: true });
        assert.strictEqual(typeof res.structuredContent.markdown, 'string');
        assert.ok(res.structuredContent.markdown.length > 0);
    });

    it('get_component_api projects the compact typed view for a tag', async () => {
        const { callTool } = server();
        const res = await callTool('get_component_api', { files: [MY_CIRCLE], tagName: 'my-circle' });
        const api = res.structuredContent;
        assert.strictEqual(api.tagName, 'my-circle');
        assert.strictEqual(api.className, 'MyCircle');
        assert.deepStrictEqual(api.attributes.map((a: any) => a.name).sort(), ['color', 'size']);
        assert.deepStrictEqual(api.properties.map((p: any) => p.name).sort(), ['color', 'size']);
        assert.strictEqual(api.events[0].name, 'size-change');
        assert.strictEqual(api.events[0].type, 'CustomEvent');
        assert.strictEqual(api.slots[0].name, '(default)');
        assert.strictEqual(api.cssParts[0].name, 'circle');
        assert.strictEqual(api.cssProperties[0].name, '--circle-color');
    });

    it('get_component_api also selects by className and can emit Markdown', async () => {
        const { callTool } = server();
        const byClass = await callTool('get_component_api', { files: [MY_CIRCLE], className: 'MyCircle' });
        assert.strictEqual(byClass.structuredContent.className, 'MyCircle');
        const md = await callTool('get_component_api', { files: [MY_CIRCLE], tagName: 'my-circle', format: 'markdown' });
        assert.strictEqual(typeof md.structuredContent.markdown, 'string');
        assert.ok(md.structuredContent.markdown.length > 0);
    });

    it('list_components reports tag, class, summary, and per-feature counts', async () => {
        const { callTool } = server();
        const res = await callTool('list_components', { files: [MY_CIRCLE] });
        const c = res.structuredContent.components[0];
        assert.strictEqual(c.tagName, 'my-circle');
        assert.strictEqual(c.className, 'MyCircle');
        assert.strictEqual(c.summary, 'Resizable, recolourable SVG circle web component.');
        assert.deepStrictEqual(c.counts, {
            attributes: 2,
            properties: 2,
            methods: 0,
            events: 1,
            slots: 1,
            cssParts: 1,
            cssProperties: 1,
        });
    });

    it('list_components scans a directory via the dir argument', async () => {
        const { callTool } = server();
        const res = await callTool('list_components', { dir: 'examples/my-circle' });
        const tags = res.structuredContent.components.map((c: any) => c.tagName);
        assert.ok(tags.includes('my-circle'), `expected my-circle in ${JSON.stringify(tags)}`);
    });

    it('an unknown tag, missing input, and bad argument types are tool errors (isError), not crashes', async () => {
        const { callTool } = server();
        const unknownTag = await callTool('get_component_api', { files: [MY_CIRCLE], tagName: 'no-such-tag' });
        assert.strictEqual(unknownTag.isError, true);

        const noInput = await callTool('list_components', {});
        assert.strictEqual(noInput.isError, true);

        // ajv rejects the wrong shape (files must be an array) before the handler runs.
        const badShape = await callTool('get_component_manifest', { files: 'not-an-array' });
        assert.strictEqual(badShape.isError, true);
        assert.match(badShape.content[0].text, /Invalid arguments/);
    });
});
