import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ManifestGenerator, toStories, manifestToStories, storiesFileName } from '../src/index.js';
import type { Package } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function manifestFor(file: string): Package {
    return new ManifestGenerator([resolve(__dirname, file)]).generate();
}

const unionDecl = () => manifestFor('fixtures/union-element.ts').modules.flatMap((m) => m.declarations)[0]!;

describe('toStories (issue #24)', () => {
    it('emits a CSF default export titled and bound to the tag', () => {
        const csf = toStories(unionDecl());
        assert.match(csf, /export default \{/);
        assert.match(csf, /title: "Components\/union-button"/);
        assert.match(csf, /component: "union-button"/);
        assert.match(csf, /export const Default = \{\};/);
    });

    it('maps a string-literal union attribute to a select control with options', () => {
        const argTypes = JSON.parse(extractObject(toStories(unionDecl()), 'argTypes'));
        assert.deepStrictEqual(argTypes.size.control, { type: 'select' });
        assert.deepStrictEqual(argTypes.size.options, ['sm', 'md', 'lg']);
    });

    it('maps boolean/text attributes and events to the right controls/actions', () => {
        const argTypes = JSON.parse(extractObject(toStories(unionDecl()), 'argTypes'));
        assert.strictEqual(argTypes.disabled.control, 'boolean');
        assert.strictEqual(argTypes.label.control, 'text');
        assert.deepStrictEqual(argTypes['union-change'], { action: 'union-change' });
    });

    it('coerces attribute defaults into the args object', () => {
        const args = JSON.parse(extractObject(toStories(unionDecl()), 'args'));
        assert.deepStrictEqual(args, { size: 'md', variant: 'primary', disabled: false, label: '' });
    });

    it('imports the element (overridable via importPath)', () => {
        assert.match(toStories(unionDecl()), /^import "\.\/union-button\.js";/m);
        assert.match(toStories(unionDecl(), { importPath: '../dist/{tag}.js' }), /import "\.\.\/dist\/union-button\.js"/);
    });

    it('manifestToStories yields one file per element with the conventional name', () => {
        const files = manifestToStories(manifestFor('fixtures/union-element.ts'));
        assert.strictEqual(files.length, 1);
        assert.strictEqual(files[0]!.fileName, 'union-button.stories.js');
        assert.strictEqual(storiesFileName(unionDecl()), 'union-button.stories.js');
    });
});

/** Extracts the JSON value of a top-level `key: {...}` block from generated CSF. */
function extractObject(source: string, key: string): string {
    const start = source.indexOf(`${key}: {`);
    assert.ok(start >= 0, `expected ${key} in CSF`);
    let depth = 0;
    let i = source.indexOf('{', start);
    const from = i;
    for (; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(from, i + 1);
    }
    throw new Error(`unbalanced braces for ${key}`);
}
