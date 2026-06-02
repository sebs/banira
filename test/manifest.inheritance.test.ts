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

describe('ManifestGenerator — inheritance from a custom base class (issue #4)', () => {
    it('reports the immediate superclass, not a flattened HTMLElement', () => {
        const decl = declarationFor('knob-element.ts');
        assert.strictEqual(decl.superclass?.name, 'ValueElement');
    });

    it('expands a spread of a base static array in observedAttributes', () => {
        const decl = declarationFor('knob-element.ts');
        const names = (decl.attributes ?? []).map((a) => a.name);
        assert.deepStrictEqual(names, [
            'value', 'min', 'max', 'step', 'disabled', 'scale', // spread of ValueElement.valueAttributes
            'reset', 'format', 'unit', // literal tail
        ]);
    });

    it('flattens public members inherited from the base class, annotated with inheritedFrom', () => {
        const decl = declarationFor('knob-element.ts');
        const byName = new Map((decl.members ?? []).map((m) => [m.name, m]));

        // own member
        assert.strictEqual(byName.get('format')?.inheritedFrom, undefined);
        // inherited fields and method
        assert.strictEqual(byName.get('value')?.inheritedFrom?.name, 'ValueElement');
        assert.strictEqual(byName.get('min')?.inheritedFrom?.name, 'ValueElement');
        const setValue = byName.get('setValue');
        assert.strictEqual(setValue?.kind, 'method');
        assert.strictEqual(setValue?.inheritedFrom?.name, 'ValueElement');
    });

    it('links inherited attributes to inherited fields (type/description)', () => {
        const decl = declarationFor('knob-element.ts');
        const value = (decl.attributes ?? []).find((a) => a.name === 'value');
        assert.strictEqual(value?.fieldName, 'value');
        assert.match(value?.description ?? '', /current value/i);
    });
});
