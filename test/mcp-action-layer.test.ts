import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMcpServer } from '../src/mcp/index.js';
import type { IncomingMessage } from '../src/mcp/protocol.js';

const MY_CIRCLE = 'examples/my-circle/my-circle.ts';

function client(opts?: { readOnly?: boolean; localOnly?: boolean; project?: string }) {
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

describe('mcp compile_component (milestone 5)', () => {
    let dir: string;
    before(() => {
        dir = mkdtempSync(join(tmpdir(), 'banira-mcp-compile-'));
        writeFileSync(
            join(dir, 'clean.ts'),
            "export class CleanEl extends HTMLElement { connectedCallback(): void { this.textContent='ok'; } } customElements.define('clean-el', CleanEl);\n"
        );
        writeFileSync(
            join(dir, 'broken.ts'),
            "export class BrokenEl extends HTMLElement { connectedCallback(): void { const n: number = 'x'; void n; } }\n"
        );
    });
    after(() => rmSync(dir, { recursive: true, force: true }));

    it('is omitted in read-only mode but present otherwise', async () => {
        const full = (await client().list('tools/list')).tools.map((t: any) => t.name);
        const ro = (await client({ readOnly: true }).list('tools/list')).tools.map((t: any) => t.name);
        assert.ok(full.includes('compile_component'));
        assert.ok(!ro.includes('compile_component'));
    });

    it('compiles a clean component and writes .js + .js.map', async () => {
        const out = join(dir, 'out');
        const res = await client().tool('compile_component', { files: [join(dir, 'clean.ts')], outDir: out });
        const sc = res.structuredContent;
        assert.strictEqual(sc.ok, true);
        assert.deepStrictEqual(
            sc.outputs.map((p: string) => p.split('/').pop()).sort(),
            ['clean.js', 'clean.js.map']
        );
        assert.ok(existsSync(join(out, 'clean.js')));
        assert.ok(existsSync(join(out, 'clean.js.map')));
    });

    it('emits output even with type errors and reports ok:false', async () => {
        const out = join(dir, 'out2');
        const res = await client().tool('compile_component', { files: [join(dir, 'broken.ts')], outDir: out });
        const sc = res.structuredContent;
        assert.strictEqual(sc.ok, false);
        assert.ok(sc.errorCount >= 1);
        assert.strictEqual(sc.outputs.length, 2); // noEmitOnError:false — files still written
        assert.ok(existsSync(join(out, 'broken.js')));
    });
});

describe('mcp generate_docs (milestone 5)', () => {
    it('is read-only and registered in both modes', async () => {
        for (const opts of [{}, { readOnly: true }]) {
            const names = (await client(opts).list('tools/list')).tools.map((t: any) => t.name);
            assert.ok(names.includes('generate_docs'));
        }
    });

    it('returns an HTML page that references the CDN stylesheet by default', async () => {
        const res = await client().tool('generate_docs', { file: MY_CIRCLE });
        const sc = res.structuredContent;
        assert.strictEqual(typeof sc.html, 'string');
        assert.ok(sc.html.length > 0);
        assert.strictEqual(sc.tagName, 'my-circle');
        assert.strictEqual(sc.stylesheetMode, 'href');
        assert.strictEqual(sc.usedNetworkDefault, true);
    });

    it('honors an explicit stylesheet:"none"', async () => {
        const res = await client().tool('generate_docs', { file: MY_CIRCLE, stylesheet: 'none' });
        assert.strictEqual(res.structuredContent.stylesheetMode, 'none');
        assert.strictEqual(res.structuredContent.usedNetworkDefault, false);
    });

    it('forces a non-network stylesheet under --local-only', async () => {
        const res = await client({ localOnly: true }).tool('generate_docs', { file: MY_CIRCLE });
        assert.strictEqual(res.structuredContent.stylesheetMode, 'none');
        assert.strictEqual(res.structuredContent.usedNetworkDefault, true);
    });
});

describe('mcp components resource (milestone 5)', () => {
    let dir: string;
    before(() => {
        dir = mkdtempSync(join(tmpdir(), 'banira-mcp-components-'));
        writeFileSync(
            join(dir, 'widget.ts'),
            "export class Widget extends HTMLElement {} customElements.define('w-idget', Widget);\n"
        );
    });
    after(() => rmSync(dir, { recursive: true, force: true }));

    it('lists the workspace-components resource and reads it as a CEM scoped to the project root', async () => {
        // project's dirname is used as the scan root; the tsconfig file itself is not read.
        const c = client({ project: join(dir, 'tsconfig.json') });
        const uris = (await c.list('resources/list')).resources.map((r: any) => r.uri);
        assert.ok(uris.includes('resource://banira/components'));

        const read = await c.send('resources/read', { uri: 'resource://banira/components' });
        assert.strictEqual(read.result.contents[0].mimeType, 'application/json');
        const pkg = JSON.parse(read.result.contents[0].text);
        assert.strictEqual(pkg.schemaVersion, '2.1.0');
        const tags = pkg.modules.flatMap((m: any) => m.declarations.map((d: any) => d.tagName));
        assert.ok(tags.includes('w-idget'), `expected w-idget in ${JSON.stringify(tags)}`);
    });
});
