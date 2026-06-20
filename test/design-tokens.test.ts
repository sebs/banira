import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ManifestGenerator, collectDesignTokens, designTokensToMarkdown } from '../src/index.js';
import type { Package } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function manifestFor(file: string): Package {
    return new ManifestGenerator([resolve(__dirname, 'fixtures/cem', file)]).generate();
}

describe('design tokens (issue #11)', () => {
    it('parses the @cssprop default from the [--name=default] syntax', () => {
        const decl = manifestFor('themed-element.ts').modules.flatMap((m) => m.declarations)[0]!;
        const size = (decl.cssProperties ?? []).find((p) => p.name === '--knob-size');
        assert.strictEqual(size?.default, '48px');
        assert.strictEqual(size?.description, 'Diameter of the knob');
    });

    it('parses a @cssprop without a default', () => {
        const decl = manifestFor('themed-element.ts').modules.flatMap((m) => m.declarations)[0]!;
        const track = (decl.cssProperties ?? []).find((p) => p.name === '--knob-track-color');
        assert.strictEqual(track?.default, undefined);
        assert.strictEqual(track?.description, 'Color of the inactive track');
    });

    it('groups tokens by their leading dashed segment', () => {
        const [component] = collectDesignTokens(manifestFor('themed-element.ts'));
        assert.ok(component);
        const groupNames = component!.groups.map((g) => g.name);
        assert.deepStrictEqual(groupNames, ['general', 'knob', 'label']);
        const knob = component!.groups.find((g) => g.name === 'knob');
        assert.deepStrictEqual(
            knob!.tokens.map((t) => t.name),
            ['--knob-active-color', '--knob-size', '--knob-track-color']
        );
    });

    it('omits components with no documented CSS custom properties', () => {
        // emitter-element documents events but no @cssprop tags.
        assert.deepStrictEqual(collectDesignTokens(manifestFor('emitter-element.ts')), []);
    });

    it('renders a grouped markdown document with defaults', () => {
        const md = designTokensToMarkdown(manifestFor('themed-element.ts'), { title: 'Theme' });
        assert.match(md, /^# Theme/);
        assert.match(md, /## `<themed-element>`/);
        assert.match(md, /### knob/);
        assert.match(md, /`--knob-size` \| `48px` \| Diameter of the knob/);
    });

    it('renders a placeholder when nothing is documented', () => {
        const empty: Package = { schemaVersion: '2.1.0', modules: [] };
        const md = designTokensToMarkdown(empty);
        assert.match(md, /# Design Tokens/);
        assert.match(md, /No CSS custom properties/);
    });
});
