import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ManifestGenerator } from '../src/index.js';
import type { CustomElementDeclaration } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function declarationFor(file: string): CustomElementDeclaration {
    const pkg = new ManifestGenerator([resolve(__dirname, 'fixtures/cem', file)]).generate();
    const decl = pkg.modules.flatMap((m) => m.declarations)[0];
    assert.ok(decl, `expected a custom element declaration in ${file}`);
    return decl;
}

describe('ManifestGenerator — events through a dispatch helper (issue #5)', () => {
    it('detects events dispatched through a one-hop emit() helper', () => {
        const decl = declarationFor('emitter-element.ts');
        const names = (decl.events ?? []).map((e) => e.name).sort();
        assert.deepStrictEqual(names, ['change', 'input']);
    });

    it('records the constructor type forwarded by the helper', () => {
        const decl = declarationFor('emitter-element.ts');
        const input = (decl.events ?? []).find((e) => e.name === 'input');
        assert.strictEqual(input?.type?.text, 'CustomEvent');
    });

    it('honors an explicit @fires jsdoc description on a helper-dispatched event', () => {
        const decl = declarationFor('emitter-element.ts');
        const change = (decl.events ?? []).find((e) => e.name === 'change');
        assert.match(change?.description ?? '', /committed value changes/i);
    });
});
