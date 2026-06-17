import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ManifestGenerator } from '../src/index.js';
import type { CustomElementDeclaration } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function declarationFor(file: string): CustomElementDeclaration {
    const gen = new ManifestGenerator([resolve(__dirname, file)]);
    const pkg = gen.generate();
    const decl = pkg.modules.flatMap((m) => m.declarations)[0];
    assert.ok(decl, `expected a custom element declaration in ${file}`);
    return decl;
}

describe('ManifestGenerator', () => {
    it('emits a 2.1.0 manifest with a custom-element-definition export', () => {
        const gen = new ManifestGenerator([resolve(__dirname, 'fixtures/rich-element.ts')]);
        const pkg = gen.generate();
        assert.strictEqual(pkg.schemaVersion, '2.1.0');
        const def = pkg.modules[0]!.exports.find((e) => e.kind === 'custom-element-definition');
        assert.deepStrictEqual(def, {
            kind: 'custom-element-definition',
            name: 'rating-widget',
            declaration: { name: 'RatingWidget' },
        });
    });

    it('detects tagName, description and superclass', () => {
        const decl = declarationFor('fixtures/rich-element.ts');
        assert.strictEqual(decl.tagName, 'rating-widget');
        assert.strictEqual(decl.customElement, true);
        assert.strictEqual(decl.superclass?.name, 'HTMLElement');
        assert.match(decl.description ?? '', /rating widget/i);
    });

    it('extracts attributes from observedAttributes and links them to properties', () => {
        const decl = declarationFor('fixtures/rich-element.ts');
        const names = (decl.attributes ?? []).map((a) => a.name).sort();
        assert.deepStrictEqual(names, ['max', 'value']);
        const value = decl.attributes!.find((a) => a.name === 'value')!;
        assert.strictEqual(value.fieldName, 'value');
        assert.match(value.description ?? '', /current rating/i);
    });

    it('exposes public properties and methods, hiding private members and lifecycle', () => {
        const decl = declarationFor('fixtures/rich-element.ts');
        const fieldNames = (decl.members ?? []).filter((m) => m.kind === 'field').map((m) => m.name).sort();
        const methodNames = (decl.members ?? []).filter((m) => m.kind === 'method').map((m) => m.name).sort();
        assert.deepStrictEqual(fieldNames, ['label', 'max', 'summary', 'value']);
        assert.deepStrictEqual(methodNames, ['reset', 'setRating']);
        assert.ok(!(decl.members ?? []).some((m) => m.name === '_value'), 'private backing field must be hidden');
        assert.ok(!(decl.members ?? []).some((m) => m.name === 'render'), 'private method must be hidden');
    });

    it('marks deprecated members and omits @internal members', () => {
        const decl = declarationFor('fixtures/rich-element.ts');
        const label = (decl.members ?? []).find((m) => m.name === 'label');
        assert.strictEqual(label?.deprecated, 'use a slot instead');
        const labelAttr = (decl.attributes ?? []).find((a) => a.name === 'label');
        assert.strictEqual(labelAttr, undefined, 'label is not observed, so it is not an attribute');
        assert.ok(!(decl.members ?? []).some((m) => m.name === 'debugDump'), '@internal method must be hidden');
    });

    it('detects read-only accessors (getter with no setter)', () => {
        const decl = declarationFor('fixtures/rich-element.ts');
        const summary = (decl.members ?? []).find((m) => m.name === 'summary');
        assert.strictEqual(summary?.kind, 'field');
        assert.strictEqual((summary as { readonly?: boolean }).readonly, true);
        const value = (decl.members ?? []).find((m) => m.name === 'value');
        assert.ok(!(value as { readonly?: boolean }).readonly, 'value has a setter, so it is not read-only');
    });

    it('extracts method parameters, return type and @param/@returns descriptions', () => {
        const decl = declarationFor('fixtures/rich-element.ts');
        const setRating = (decl.members ?? []).find((m) => m.name === 'setRating');
        assert.strictEqual(setRating?.kind, 'method');
        const method = setRating as import('../src/index.js').ClassMethod;
        assert.deepStrictEqual(
            (method.parameters ?? []).map((p) => ({ name: p.name, type: p.type?.text, optional: p.optional })),
            [
                { name: 'star', type: 'number', optional: undefined },
                { name: 'animate', type: 'boolean', optional: true },
            ]
        );
        assert.match((method.parameters ?? [])[0]?.description ?? '', /star index/i);
        assert.strictEqual(method.return?.type?.text, 'number');
        assert.match(method.return?.description ?? '', /clamped value/i);
    });

    it('detects events from CustomEvent construction and @fires descriptions', () => {
        const decl = declarationFor('fixtures/rich-element.ts');
        const event = (decl.events ?? []).find((e) => e.name === 'rating-change');
        assert.ok(event, 'expected rating-change event');
        assert.strictEqual(event!.type?.text, 'CustomEvent');
        assert.match(event!.description ?? '', /rating changes/i);
    });

    it('extracts slots, css parts and css custom properties from jsdoc', () => {
        const decl = declarationFor('fixtures/rich-element.ts');
        assert.deepStrictEqual((decl.slots ?? []).map((s) => s.name).sort(), ['', 'icon']);
        assert.deepStrictEqual((decl.cssParts ?? []).map((p) => p.name), ['star']);
        assert.deepStrictEqual((decl.cssProperties ?? []).map((p) => p.name), ['--rating-color']);
    });

    it('analyzes a plain component (my-circle) without jsdoc tags', () => {
        const decl = declarationFor('../examples/my-circle/my-circle.ts');
        assert.strictEqual(decl.tagName, 'my-circle');
        assert.deepStrictEqual((decl.attributes ?? []).map((a) => a.name).sort(), ['color', 'size']);
    });
});
