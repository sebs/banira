import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import { linkManifestField } from '../src/index.js';

function tmp(): string {
    return mkdtempSync(resolve(tmpdir(), 'banira-link-'));
}

describe('linkManifestField (issue #23)', () => {
    it('sets the customElements field to the package-relative manifest path', () => {
        const dir = tmp();
        writeFileSync(join(dir, 'package.json'), '{\n  "name": "x"\n}\n', 'utf8');
        const manifest = join(dir, 'custom-elements.json');
        writeFileSync(manifest, '{}', 'utf8');

        const result = linkManifestField(manifest);
        assert.strictEqual(result.changed, true);
        assert.strictEqual(result.field, 'custom-elements.json');
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        assert.strictEqual(pkg.customElements, 'custom-elements.json');
    });

    it('uses a POSIX relative path when the manifest is in a subdirectory', () => {
        const dir = tmp();
        writeFileSync(join(dir, 'package.json'), '{\n  "name": "x"\n}\n', 'utf8');
        mkdirSync(join(dir, 'dist'));
        const manifest = join(dir, 'dist', 'custom-elements.json');
        writeFileSync(manifest, '{}', 'utf8');

        assert.strictEqual(linkManifestField(manifest).field, 'dist/custom-elements.json');
    });

    it('finds the nearest package.json walking up from the manifest', () => {
        const dir = tmp();
        writeFileSync(join(dir, 'package.json'), '{\n  "name": "root"\n}\n', 'utf8');
        mkdirSync(join(dir, 'a', 'b'), { recursive: true });
        const manifest = join(dir, 'a', 'b', 'custom-elements.json');
        writeFileSync(manifest, '{}', 'utf8');

        const result = linkManifestField(manifest);
        assert.strictEqual(result.packageJsonPath, join(dir, 'package.json'));
        assert.strictEqual(result.field, 'a/b/custom-elements.json');
    });

    it('is a no-op when the field already points at the manifest', () => {
        const dir = tmp();
        writeFileSync(join(dir, 'package.json'), '{\n  "customElements": "custom-elements.json"\n}\n', 'utf8');
        const manifest = join(dir, 'custom-elements.json');
        writeFileSync(manifest, '{}', 'utf8');

        const before = readFileSync(join(dir, 'package.json'), 'utf8');
        const result = linkManifestField(manifest);
        assert.strictEqual(result.changed, false);
        assert.strictEqual(readFileSync(join(dir, 'package.json'), 'utf8'), before);
    });

    it('preserves tab indentation and the trailing newline', () => {
        const dir = tmp();
        writeFileSync(join(dir, 'package.json'), '{\n\t"name": "x"\n}\n', 'utf8');
        const manifest = join(dir, 'custom-elements.json');
        writeFileSync(manifest, '{}', 'utf8');

        linkManifestField(manifest);
        const raw = readFileSync(join(dir, 'package.json'), 'utf8');
        assert.match(raw, /\n\t"name": "x"/);
        assert.match(raw, /\n\t"customElements": "custom-elements\.json"/);
        assert.ok(raw.endsWith('\n'));
    });

    it('throws when no package.json is found above the manifest', () => {
        const dir = tmp();
        const manifest = join(dir, 'custom-elements.json');
        writeFileSync(manifest, '{}', 'utf8');
        // /tmp has no package.json above it in the test sandbox roots.
        assert.throws(() => linkManifestField(manifest, dir), /No package\.json found/);
    });
});
