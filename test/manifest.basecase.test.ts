import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ManifestGenerator } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (f: string): string => resolve(__dirname, 'fixtures/cem', f);

describe('ManifestGenerator — base classes and helper registration (issue #3)', () => {
    it('detects a component that extends a base class and registers via a helper', () => {
        const pkg = new ManifestGenerator([fixture('my-widget.ts')]).generate();
        const decl = pkg.modules.flatMap((m) => m.declarations)[0];
        assert.ok(decl, 'expected a custom-element declaration');
        assert.strictEqual(decl.name, 'MyWidget');
        assert.strictEqual(decl.customElement, true);
        // helper-based registration yields the tag name
        assert.strictEqual(decl.tagName, 'my-widget');
        // and a custom-element-definition export is emitted
        const def = pkg.modules[0]!.exports.find((e) => e.kind === 'custom-element-definition');
        assert.strictEqual(def?.name, 'my-widget');
    });

    it('still extracts members through the base-class component', () => {
        const pkg = new ManifestGenerator([fixture('my-widget.ts')]).generate();
        const decl = pkg.modules.flatMap((m) => m.declarations)[0]!;
        assert.deepStrictEqual((decl.attributes ?? []).map((a) => a.name), ['size']);
        assert.ok((decl.slots ?? []).some((s) => s.name === 'label'));
    });

    it('does not emit a declaration for an abstract base class', () => {
        const pkg = new ManifestGenerator([fixture('base-element.ts')]).generate();
        assert.deepStrictEqual(pkg.modules.flatMap((m) => m.declarations), []);
    });

    it('keeps the direct extends HTMLElement + customElements.define path working', () => {
        const pkg = new ManifestGenerator([resolve(__dirname, 'fixtures/my-circle.ts')]).generate();
        const decl = pkg.modules.flatMap((m) => m.declarations)[0];
        assert.strictEqual(decl?.tagName, 'my-circle');
    });
});
