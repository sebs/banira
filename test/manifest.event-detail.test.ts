import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ManifestGenerator, eventTypeText, manifestToMarkdown, toTypeDefinitions } from '../src/index.js';
import type { CustomElementDeclaration, Package } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function manifestFor(file: string): Package {
    return new ManifestGenerator([resolve(__dirname, 'fixtures/cem', file)]).generate();
}

function declarationFor(file: string): CustomElementDeclaration {
    const decl = manifestFor(file).modules.flatMap((m) => m.declarations)[0];
    assert.ok(decl, `expected a custom element declaration in ${file}`);
    return decl;
}

describe('ManifestGenerator — event detail/payload type (issue #16)', () => {
    it('captures the detail type from a new CustomEvent<Detail>() annotation', () => {
        const decl = declarationFor('detail-event-element.ts');
        const change = (decl.events ?? []).find((e) => e.name === 'change');
        assert.strictEqual(change?.type?.text, 'CustomEvent');
        assert.strictEqual(change?.detailType?.text, '{ value: number }');
    });

    it('leaves a plain new Event() without a detail type', () => {
        const decl = declarationFor('detail-event-element.ts');
        const input = (decl.events ?? []).find((e) => e.name === 'input');
        assert.strictEqual(input?.type?.text, 'Event');
        assert.strictEqual(input?.detailType, undefined);
    });

    it('captures the detail type from a @fires {Detail} name tag', () => {
        const decl = declarationFor('detail-event-element.ts');
        const resize = (decl.events ?? []).find((e) => e.name === 'resize');
        assert.strictEqual(resize?.detailType?.text, '{ ratio: number }');
        assert.match(resize?.description ?? '', /resized/i);
    });

    it('captures the detail type forwarded as a helper type argument', () => {
        // emit<{ value: number }>(this, 'change', ...) — type arg at the call site.
        const decl = declarationFor('emitter-element.ts');
        const change = (decl.events ?? []).find((e) => e.name === 'change');
        // emitter-element calls emit(...) without an explicit type argument, so no detail.
        assert.strictEqual(change?.detailType, undefined);
    });

    it('eventTypeText composes constructor<Detail> when a detail type is present', () => {
        assert.strictEqual(eventTypeText({ name: 'x', type: { text: 'CustomEvent' } }), 'CustomEvent');
        assert.strictEqual(
            eventTypeText({ name: 'x', type: { text: 'CustomEvent' }, detailType: { text: '{ a: 1 }' } }),
            'CustomEvent<{ a: 1 }>'
        );
    });

    it('renders the full event type in the markdown events table', () => {
        const md = manifestToMarkdown(manifestFor('detail-event-element.ts'));
        assert.match(md, /`change` \| `CustomEvent<\{ value: number \}>`/);
    });

    it('emits typed addEventListener overloads in the generated .d.ts', () => {
        const dts = toTypeDefinitions(manifestFor('detail-event-element.ts'));
        assert.match(dts, /addEventListener\(type: "change", listener: \(this: \w+, ev: CustomEvent<\{ value: number \}>\)/);
        assert.match(dts, /removeEventListener\(type: "change",/);
    });
});
