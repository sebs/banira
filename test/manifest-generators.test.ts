import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    ManifestGenerator,
    manifestToMarkdown,
    validateManifest,
    validateManifestSchema,
    toVsCodeHtmlData,
    toVsCodeCssData,
    toWebTypes,
    toTypeDefinitions,
    diffManifests,
} from '../src/index.js';
import type { Package } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function manifestFor(file: string): Package {
    return new ManifestGenerator([resolve(__dirname, file)]).generate();
}

const rich = () => manifestFor('fixtures/rich-element.ts');

describe('manifestToMarkdown', () => {
    it('renders a heading, tables and the deprecation marker', () => {
        const md = manifestToMarkdown(rich(), { title: 'Components' });
        assert.match(md, /^# Components/);
        assert.match(md, /## `<rating-widget>`/);
        assert.match(md, /### Attributes/);
        assert.match(md, /\| `value` \|/);
        assert.match(md, /### Methods/);
        assert.match(md, /`setRating\(star, animate\?\)`/);
        assert.match(md, /### Slots/);
        assert.match(md, /\*\*Deprecated: use a slot instead\*\*/);
    });

    it('honors the heading level', () => {
        const md = manifestToMarkdown(rich(), { headingLevel: 3 });
        assert.match(md, /### `<rating-widget>`/);
    });
});

describe('validateManifest', () => {
    it('returns no issues for a well-formed manifest', () => {
        assert.deepStrictEqual(validateManifest(rich()), []);
    });

    it('flags an invalid tag name and a malformed module', () => {
        const broken: Package = {
            schemaVersion: '2.1.0',
            modules: [
                {
                    kind: 'javascript-module',
                    path: 'x.js',
                    declarations: [{ kind: 'class', name: 'X', customElement: true, tagName: 'nohyphen' }],
                    exports: [],
                },
            ],
        };
        const issues = validateManifest(broken);
        assert.ok(issues.some((i) => i.severity === 'warning' && /not a valid custom element name/.test(i.message)));
    });

    it('reports a missing schemaVersion as an error', () => {
        const issues = validateManifest({ schemaVersion: '', modules: [] } as Package);
        assert.ok(issues.some((i) => i.severity === 'error' && i.path === 'schemaVersion'));
    });
});

describe('validateManifestSchema (official CEM JSON Schema)', () => {
    it('returns no issues for a spec-conformant manifest', async () => {
        assert.deepStrictEqual(await validateManifestSchema(rich()), []);
    });

    it('flags a module missing the required `path` with a path-level error', async () => {
        const broken = {
            schemaVersion: '2.1.0',
            modules: [{ kind: 'javascript-module', declarations: [], exports: [] }],
        } as unknown as Package;
        const issues = await validateManifestSchema(broken);
        assert.ok(
            issues.some((i) => i.severity === 'error' && i.path === 'modules[0].path'),
            `expected a modules[0].path error, got: ${JSON.stringify(issues)}`
        );
    });

    it('flags a value outside an enum with the allowed values', async () => {
        const broken = {
            schemaVersion: '2.1.0',
            modules: [
                {
                    kind: 'not-a-module-kind',
                    path: 'x.js',
                    declarations: [],
                    exports: [],
                },
            ],
        } as unknown as Package;
        const issues = await validateManifestSchema(broken);
        assert.ok(
            issues.some((i) => i.severity === 'error' && i.path === 'modules[0].kind'),
            `expected a modules[0].kind error, got: ${JSON.stringify(issues)}`
        );
    });

    it('reports the top-level missing schemaVersion against the schema', async () => {
        const issues = await validateManifestSchema({ modules: [] } as unknown as Package);
        assert.ok(issues.some((i) => i.severity === 'error' && i.path === 'schemaVersion'));
    });
});

describe('editor data', () => {
    it('builds VS Code HTML custom-data with tags and attributes', () => {
        const data = toVsCodeHtmlData(rich());
        assert.strictEqual(data.version, 1.1);
        const tag = data.tags.find((t) => t.name === 'rating-widget');
        assert.ok(tag, 'expected rating-widget tag');
        assert.ok(tag!.attributes.some((a) => a.name === 'value'));
    });

    it('builds VS Code CSS custom-data from css custom properties', () => {
        const data = toVsCodeCssData(rich());
        assert.ok(data.properties.some((p) => p.name === '--rating-color'));
    });

    it('builds JetBrains web-types with properties and events', () => {
        const data = toWebTypes(rich(), { name: 'demo', version: '1.2.3' });
        assert.strictEqual(data.version, '1.2.3');
        const el = data.contributions.html.elements.find((e) => e.name === 'rating-widget');
        assert.ok(el, 'expected element');
        assert.ok(el!.js?.properties?.some((p) => p.name === 'value'));
        assert.ok(el!.js?.events?.some((e) => e.name === 'rating-change'));
        const label = el!.js?.properties?.find((p) => p.name === 'label');
        assert.strictEqual(label?.deprecated, true);
    });
});

describe('toTypeDefinitions', () => {
    it('emits a self-contained interface and tag-name map augmentation', () => {
        const dts = toTypeDefinitions(rich());
        assert.match(dts, /export interface RatingWidgetElement extends HTMLElement/);
        assert.match(dts, /readonly summary: string;/);
        assert.match(dts, /setRating\(star: number, animate\?: boolean\): number;/);
        assert.match(dts, /interface HTMLElementTagNameMap/);
        assert.match(dts, /'rating-widget': RatingWidgetElement;/);
        assert.doesNotMatch(dts, /namespace JSX/);
    });

    it('adds a JSX augmentation when requested', () => {
        const dts = toTypeDefinitions(rich(), { jsx: true });
        assert.match(dts, /namespace JSX/);
        assert.match(dts, /IntrinsicElements/);
    });

    it('includes members inherited from a custom base class (issue #21)', () => {
        const dts = toTypeDefinitions(manifestFor('fixtures/cem/knob-element.ts'));
        // own member
        assert.match(dts, /format:/);
        // members inherited from ValueElement must not be dropped, since the
        // interface extends HTMLElement (not the base) — they live nowhere else.
        assert.match(dts, /value: number;/);
        assert.match(dts, /min: number;/);
        assert.match(dts, /setValue\(/);
    });
});

describe('diffManifests', () => {
    it('reports patch for identical manifests', () => {
        const diff = diffManifests(rich(), rich());
        assert.strictEqual(diff.changes.length, 0);
        assert.strictEqual(diff.release, 'patch');
    });

    it('reports minor for an added member and major for a removal', () => {
        const before = manifestFor('../examples/my-circle/my-circle.ts');
        const added = diffManifests(before, rich());
        // rich-element vs my-circle: different tags → both added and removed → major.
        assert.strictEqual(added.release, 'major');

        const base: Package = JSON.parse(JSON.stringify(rich()));
        const withExtra: Package = JSON.parse(JSON.stringify(rich()));
        withExtra.modules[0]!.declarations[0]!.members!.push({ kind: 'field', name: 'extra', privacy: 'public' });
        assert.strictEqual(diffManifests(base, withExtra).release, 'minor');
        assert.strictEqual(diffManifests(withExtra, base).release, 'major');
    });
});

describe('string-literal union attributes (issue #25)', () => {
    const union = () => manifestFor('fixtures/union-element.ts');

    it('captures the allowed values from a union-typed attribute', () => {
        const decl = union().modules.flatMap((m) => m.declarations)[0]!;
        const size = (decl.attributes ?? []).find((a) => a.name === 'size');
        assert.deepStrictEqual(size?.values, ['sm', 'md', 'lg']);
        assert.strictEqual(size?.type?.text, '"sm" | "md" | "lg"');
    });

    it('leaves plain string/boolean attributes without a values list', () => {
        const decl = union().modules.flatMap((m) => m.declarations)[0]!;
        assert.strictEqual((decl.attributes ?? []).find((a) => a.name === 'label')?.values, undefined);
        assert.strictEqual((decl.attributes ?? []).find((a) => a.name === 'disabled')?.values, undefined);
    });

    it('emits the union in the generated .d.ts', () => {
        const dts = toTypeDefinitions(union());
        assert.match(dts, /size: "sm" \| "md" \| "lg";/);
        assert.match(dts, /variant: "primary" \| "secondary" \| "ghost";/);
    });

    it('emits VS Code custom-data values for the union attribute', () => {
        const data = toVsCodeHtmlData(union());
        const tag = data.tags.find((t) => t.name === 'union-button');
        const size = tag?.attributes.find((a) => a.name === 'size');
        assert.deepStrictEqual(size?.values, [{ name: 'sm' }, { name: 'md' }, { name: 'lg' }]);
        const label = tag?.attributes.find((a) => a.name === 'label');
        assert.strictEqual(label?.values, undefined);
    });
});
