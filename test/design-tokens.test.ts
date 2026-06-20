import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    ManifestGenerator,
    collectDesignTokens,
    designTokensToMarkdown,
    parseDesignTokens,
    designTokensToCss,
    tokensToCssProperties,
    enrichManifestCssProperties,
} from '../src/index.js';
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

describe('DTCG import (issue #49)', () => {
    const doc = {
        color: {
            $type: 'color',
            primary: { $value: '#3366ff', $description: 'Brand primary' },
            accent: { $value: '{color.primary}' },
        },
        space: {
            $type: 'dimension',
            sm: { $value: '4px' },
            md: { $value: { value: 8, unit: 'px' } },
        },
        shadow: {
            // composite token — not expressible as a single CSS value, should be skipped
            card: { $type: 'shadow', $value: { offsetX: '0', offsetY: '2px', blur: '4px', color: '#0003' } },
        },
    };

    it('flattens groups into dashed custom-property names and inherits $type', () => {
        const tokens = parseDesignTokens(doc);
        const primary = tokens.find((t) => t.path === 'color.primary');
        assert.strictEqual(primary?.name, '--color-primary');
        assert.strictEqual(primary?.value, '#3366ff');
        assert.strictEqual(primary?.type, 'color');
        assert.strictEqual(primary?.description, 'Brand primary');
    });

    it('resolves {alias} references to the target value', () => {
        const tokens = parseDesignTokens(doc);
        assert.strictEqual(tokens.find((t) => t.path === 'color.accent')?.value, '#3366ff');
    });

    it('renders dimension objects as value+unit and skips composite tokens', () => {
        const tokens = parseDesignTokens(doc);
        assert.strictEqual(tokens.find((t) => t.path === 'space.md')?.value, '8px');
        assert.strictEqual(
            tokens.find((t) => t.path.startsWith('shadow')),
            undefined
        );
    });

    it('throws on a circular reference', () => {
        assert.throws(
            () => parseDesignTokens({ a: { $value: '{b}' }, b: { $value: '{a}' } }),
            /circular token reference/
        );
    });

    it('emits a :root stylesheet (selector overridable)', () => {
        const css = designTokensToCss(parseDesignTokens(doc));
        assert.match(css, /^:root \{/);
        assert.match(css, /--color-primary: #3366ff;/);
        assert.match(css, /--space-md: 8px;/);
        const scoped = designTokensToCss(parseDesignTokens(doc), { selector: '.theme' });
        assert.match(scoped, /^\.theme \{/);
    });

    it('maps tokens to manifest cssProperties', () => {
        const props = tokensToCssProperties(parseDesignTokens(doc));
        const primary = props.find((p) => p.name === '--color-primary');
        assert.strictEqual(primary?.default, '#3366ff');
        assert.strictEqual(primary?.description, 'Brand primary');
    });

    it('enriches matching component cssProperties in place, leaving authored values', () => {
        const pkg: Package = {
            schemaVersion: '2.1.0',
            modules: [
                {
                    kind: 'javascript-module',
                    path: 'x.js',
                    declarations: [
                        {
                            kind: 'class',
                            name: 'X',
                            customElement: true,
                            tagName: 'x-el',
                            cssProperties: [
                                { name: '--color-primary' }, // no default -> filled from tokens
                                { name: '--space-sm', default: '0.25rem' }, // authored default -> kept
                            ],
                        },
                    ],
                    exports: [],
                },
            ],
        };
        const enriched = enrichManifestCssProperties(pkg, parseDesignTokens(doc));
        assert.strictEqual(enriched, 1);
        const props = pkg.modules[0]!.declarations[0]!.cssProperties!;
        assert.strictEqual(props.find((p) => p.name === '--color-primary')?.default, '#3366ff');
        assert.strictEqual(props.find((p) => p.name === '--space-sm')?.default, '0.25rem');
    });
});
