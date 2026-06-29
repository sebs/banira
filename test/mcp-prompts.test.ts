import { describe, it } from 'node:test';
import assert from 'node:assert';
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
        get: (name: string, args?: Record<string, string>) => send('prompts/get', { name, arguments: args ?? {} }),
        list: async (method: string) => (await send(method)).result,
    };
}

describe('mcp prompts (milestone 6)', () => {
    it('lists the three guided-workflow prompts with their argument specs', async () => {
        const prompts = (await client().list('prompts/list')).prompts;
        const byName = Object.fromEntries(prompts.map((p: any) => [p.name, p]));
        assert.ok(byName.implement_component_with_attributes);
        assert.ok(byName.add_event_to_component);
        assert.ok(byName.document_and_verify);
        const implArgs = byName.implement_component_with_attributes.arguments.map((a: any) => [a.name, !!a.required]);
        assert.deepStrictEqual(implArgs, [['tagName', true], ['attributes', true]]);
    });

    it('implement_component_with_attributes renders a single user/text message that drives the tools', async () => {
        const res = await client().get('implement_component_with_attributes', { tagName: 'my-x', attributes: 'size,color' });
        const msg = res.result.messages[0];
        assert.strictEqual(msg.role, 'user');
        assert.strictEqual(msg.content.type, 'text'); // prompt content is a single object, not an array
        assert.match(msg.content.text, /scaffold_component/);
        assert.match(msg.content.text, /my-x/);
        assert.match(msg.content.text, /size,color/);
    });

    it('add_event_to_component wires the @fires JSDoc and uses the detail type', async () => {
        const res = await client().get('add_event_to_component', {
            file: 'a.ts',
            eventName: 'value-change',
            detailType: '{ value: number }',
        });
        const text = res.result.messages[0].content.text;
        assert.match(text, /@fires/);
        assert.match(text, /value-change/);
        assert.match(text, /value: number/);
    });

    it('document_and_verify chains scaffold → check → test → docs in full mode', async () => {
        const res = await client().get('document_and_verify', { file: 'a.ts', tagName: 'my-x' });
        const text = res.result.messages[0].content.text;
        for (const tool of ['scaffold_component', 'check_component', 'test_component', 'generate_docs']) {
            assert.match(text, new RegExp(tool));
        }
    });

    it('document_and_verify is verify-only in read-only mode (no scaffold/docs)', async () => {
        const res = await client({ readOnly: true }).get('document_and_verify', { file: 'a.ts', tagName: 'my-x' });
        const text = res.result.messages[0].content.text;
        assert.match(text, /check_component/);
        assert.match(text, /test_component/);
        assert.doesNotMatch(text, /scaffold_component/);
        assert.doesNotMatch(text, /generate_docs/);
    });

    it('rejects a missing required argument and an unknown prompt with -32602', async () => {
        const missing = await client().get('document_and_verify', { file: 'a.ts' });
        assert.strictEqual(missing.error.code, -32602);

        const unknown = await client().get('no-such-prompt');
        assert.strictEqual(unknown.error.code, -32602);
    });
});
