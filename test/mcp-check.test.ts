import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMcpServer } from '../src/mcp/index.js';
import type { IncomingMessage } from '../src/mcp/protocol.js';

describe('mcp check_component (milestone 2)', () => {
    let dir: string;
    const { handle } = createMcpServer();
    let id = 0;

    const check = async (files: string[], extra: Record<string, unknown> = {}): Promise<any> => {
        const msg: IncomingMessage = {
            jsonrpc: '2.0',
            method: 'tools/call',
            id: ++id,
            params: { name: 'check_component', arguments: { files, ...extra } },
        };
        const res = (await handle(msg)) as any;
        return res.result;
    };

    before(() => {
        dir = mkdtempSync(join(tmpdir(), 'banira-mcp-check-'));
        writeFileSync(join(dir, 'clean.ts'), "export class CleanEl extends HTMLElement { connectedCallback(): void { this.textContent = 'ok'; } }\n");
        writeFileSync(join(dir, 'broken.ts'), "export class BrokenEl extends HTMLElement { connectedCallback(): void { const n: number = 'nope'; void n; } }\n");
        writeFileSync(join(dir, 'css.ts'), "import sheet from './styles.css'; export class CssEl extends HTMLElement { s = sheet; }\n");
    });

    after(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('registers check_component in both full and read-only mode', async () => {
        for (const opts of [{}, { readOnly: true }]) {
            const { handle: h } = createMcpServer(opts);
            const res = (await h({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as any;
            const names = res.result.tools.map((t: any) => t.name);
            assert.ok(names.includes('check_component'), `expected check_component in ${JSON.stringify(names)}`);
            const tool = res.result.tools.find((t: any) => t.name === 'check_component');
            assert.strictEqual(tool.annotations.readOnlyHint, true);
        }
    });

    it('reports ok for a clean component', async () => {
        const res = await check([join(dir, 'clean.ts')]);
        assert.notStrictEqual(res.isError, true);
        assert.strictEqual(res.structuredContent.ok, true);
        assert.strictEqual(res.structuredContent.errorCount, 0);
        assert.deepStrictEqual(res.structuredContent.diagnostics, []);
    });

    it('reports structured diagnostics with line/column for a type error', async () => {
        const res = await check([join(dir, 'broken.ts')]);
        const sc = res.structuredContent;
        assert.strictEqual(sc.ok, false);
        assert.ok(sc.errorCount >= 1);
        const d = sc.diagnostics[0];
        assert.strictEqual(d.code, 2322); // Type 'string' is not assignable to type 'number'
        assert.strictEqual(d.category, 'error');
        assert.strictEqual(d.line, 1);
        assert.strictEqual(typeof d.column, 'number');
        assert.match(d.file, /broken\.ts$/);
    });

    it('filters the expected CSS-module-not-found error (import "./x.css")', async () => {
        const res = await check([join(dir, 'css.ts')]);
        assert.strictEqual(res.structuredContent.ok, true);
        assert.strictEqual(res.structuredContent.errorCount, 0);
    });

    it('does not write any output to disk (virtual-FS compile)', async () => {
        await check([join(dir, 'clean.ts')]);
        await check([join(dir, 'broken.ts')]);
        const emitted = readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.js.map'));
        assert.deepStrictEqual(emitted, [], `no .js should be emitted, found ${JSON.stringify(emitted)}`);
    });

    it('turns a missing file and an unparseable --project into tool errors (isError)', async () => {
        const missing = await check([join(dir, 'does-not-exist.ts')]);
        assert.strictEqual(missing.isError, true);

        const badProject = await check([join(dir, 'clean.ts')], { project: join(dir, 'no-tsconfig.json') });
        assert.strictEqual(badProject.isError, true);
        assert.match(badProject.content[0].text, /tsconfig\.json not found/);
    });
});
