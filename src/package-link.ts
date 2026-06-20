import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, resolve, relative, sep, join, parse } from 'path';

export interface LinkManifestResult {
    /** The `package.json` that was updated (or would be). */
    packageJsonPath: string;
    /** The value written to the `customElements` field (manifest path, package-relative, POSIX). */
    field: string;
    /** False when the field already pointed at the manifest (no write performed). */
    changed: boolean;
}

/** Finds the nearest `package.json` walking up from `startDir`, or undefined. */
function findPackageJson(startDir: string): string | undefined {
    let dir = resolve(startDir);
    const { root } = parse(dir);
    for (;;) {
        const candidate = join(dir, 'package.json');
        if (existsSync(candidate)) return candidate;
        if (dir === root) return undefined;
        dir = dirname(dir);
    }
}

/** Detects the indentation (spaces/tabs) used by a JSON document, defaulting to two spaces. */
function detectIndent(raw: string): string {
    const match = /\n([ \t]+)"/.exec(raw);
    return match ? match[1]! : '  ';
}

/**
 * Points a package's `package.json` `customElements` field at a generated
 * manifest — the convention IDEs (VS Code, JetBrains) and Storybook use to
 * auto-discover a package's Custom Elements Manifest.
 *
 * Resolves the nearest `package.json` above the manifest, writes the field as a
 * POSIX path relative to that package root, and preserves the file's existing
 * indentation and trailing newline. A no-op (`changed: false`) when the field
 * already points at the same file.
 *
 * @param manifestPath Path to the written manifest (e.g. `custom-elements.json`).
 * @param startDir Where to begin the upward search (defaults to the manifest's directory).
 * @throws Error if no `package.json` is found.
 */
export function linkManifestField(manifestPath: string, startDir?: string): LinkManifestResult {
    const absManifest = resolve(manifestPath);
    const packageJsonPath = findPackageJson(startDir ? resolve(startDir) : dirname(absManifest));
    if (!packageJsonPath) {
        throw new Error(`No package.json found above ${absManifest}`);
    }

    const raw = readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const field = relative(dirname(packageJsonPath), absManifest).split(sep).join('/');

    // The manifest must live inside the package it's linked from: a field that
    // escapes the package root with `..` would point a published `customElements`
    // entry at an out-of-package file.
    if (field.startsWith('../') || field === '..') {
        throw new Error(`Manifest ${absManifest} is outside the package at ${dirname(packageJsonPath)}`);
    }

    if (pkg.customElements === field) {
        return { packageJsonPath, field, changed: false };
    }

    pkg.customElements = field;
    const indent = detectIndent(raw);
    const trailingNewline = raw.endsWith('\n') ? '\n' : '';
    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, indent) + trailingNewline, 'utf8');
    return { packageJsonPath, field, changed: true };
}
