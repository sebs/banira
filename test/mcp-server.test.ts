import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createMcpServer } from '../src/mcp/index.js';
import { decode, negotiateVersion, LATEST_PROTOCOL_VERSION, type IncomingMessage } from '../src/mcp/protocol.js';
import { validateArgs } from '../src/mcp/validate.js';

const req = (id: number, method: string, params?: unknown): IncomingMessage => ({
    jsonrpc: '2.0',
    method,
    id,
    ...(params !== undefined ? { params } : {}),
});

describe('mcp server dispatch (milestone 0)', () => {
    const { handle } = createMcpServer();

    it('initialize echoes a supported protocol version and advertises capabilities', async () => {
        const res = (await handle(
            req(1, 'initialize', {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 't', version: '0' },
            })
        )) as any;
        assert.strictEqual(res.result.protocolVersion, '2025-11-25');
        assert.strictEqual(res.result.serverInfo.name, 'banira');
        assert.deepStrictEqual(Object.keys(res.result.capabilities).sort(), ['prompts', 'resources', 'tools']);
    });

    it('initialize downgrades an unknown version to the latest', async () => {
        const res = (await handle(req(2, 'initialize', { protocolVersion: '1999-01-01' }))) as any;
        assert.strictEqual(res.result.protocolVersion, LATEST_PROTOCOL_VERSION);
    });

    it('ping returns an empty result', async () => {
        const res = (await handle(req(3, 'ping'))) as any;
        assert.deepStrictEqual(res.result, {});
    });

    it('lists registered tools, resources, and prompts', async () => {
        const tools = (await handle(req(4, 'tools/list'))) as any;
        const resources = (await handle(req(5, 'resources/list'))) as any;
        const prompts = (await handle(req(6, 'prompts/list'))) as any;
        assert.ok(tools.result.tools.length >= 3);
        assert.ok(resources.result.resources.length >= 1);
        assert.ok(prompts.result.prompts.length >= 1);
    });

    it('answers resources/templates/list with an empty list (not -32601)', async () => {
        const res = (await handle(req(11, 'resources/templates/list'))) as any;
        assert.ok(res.result, 'expected a result, not an error');
        assert.deepStrictEqual(res.result.resourceTemplates, []);
    });

    it('an unknown method is method-not-found (-32601)', async () => {
        const res = (await handle(req(7, 'does/not/exist'))) as any;
        assert.strictEqual(res.error.code, -32601);
    });

    it('an unknown tool call is invalid-params (-32602)', async () => {
        const res = (await handle(req(8, 'tools/call', { name: 'nope', arguments: {} }))) as any;
        assert.strictEqual(res.error.code, -32602);
    });

    it('an unknown prompt get is invalid-params (-32602)', async () => {
        const res = (await handle(req(9, 'prompts/get', { name: 'nope' }))) as any;
        assert.strictEqual(res.error.code, -32602);
    });

    it('an unknown resource read is resource-not-found (-32002)', async () => {
        const res = (await handle(req(10, 'resources/read', { uri: 'resource://banira/nope' }))) as any;
        assert.strictEqual(res.error.code, -32002);
    });

    it('a notification is not answered', async () => {
        const notification: IncomingMessage = { jsonrpc: '2.0', method: 'notifications/initialized' };
        const res = await handle(notification);
        assert.strictEqual(res, null);
    });
});

describe('mcp transport decode', () => {
    it('flags malformed JSON as parse error (-32700)', () => {
        const d = decode('{ not json') as any;
        assert.strictEqual(d.kind, 'error');
        assert.strictEqual(d.response.error.code, -32700);
    });

    it('rejects a JSON-RPC batch as invalid request (-32600)', () => {
        const d = decode('[{"jsonrpc":"2.0","id":1,"method":"ping"}]') as any;
        assert.strictEqual(d.kind, 'error');
        assert.strictEqual(d.response.error.code, -32600);
    });

    it('rejects a null id as invalid request (-32600)', () => {
        const d = decode('{"jsonrpc":"2.0","id":null,"method":"ping"}') as any;
        assert.strictEqual(d.kind, 'error');
        assert.strictEqual(d.response.error.code, -32600);
    });

    it('passes a well-formed frame through', () => {
        const d = decode('{"jsonrpc":"2.0","id":1,"method":"ping"}');
        assert.strictEqual(d.kind, 'message');
    });

    it('ignores a blank line', () => {
        assert.strictEqual(decode('   ').kind, 'empty');
    });
});

describe('negotiateVersion', () => {
    it('echoes a supported version', () => {
        assert.strictEqual(negotiateVersion('2025-06-18'), '2025-06-18');
    });

    it('falls back to the latest for an unknown or non-string version', () => {
        assert.strictEqual(negotiateVersion('2030-01-01'), LATEST_PROTOCOL_VERSION);
        assert.strictEqual(negotiateVersion(undefined), LATEST_PROTOCOL_VERSION);
    });
});

describe('validateArgs (ajv runtime dependency)', () => {
    const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
    };

    it('accepts a conforming object', () => {
        assert.deepStrictEqual(validateArgs(schema, { name: 'x' }), { valid: true, errors: [] });
    });

    it('reports a missing required field', () => {
        const result = validateArgs(schema, {});
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.length >= 1);
    });

    it('reports an unexpected property', () => {
        const result = validateArgs(schema, { name: 'x', extra: 1 });
        assert.strictEqual(result.valid, false);
    });
});
