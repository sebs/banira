import * as ts from 'typescript';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { dirname, resolve, join } from 'path';

/** An [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap). */
export interface ImportMap {
    imports: Record<string, string>;
}

/** The dependency fields of a `package.json` used to resolve versions. */
export interface PackageJsonLike {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

export interface ImportMapOptions {
    /** CDN base URL the bare specifiers are pinned to (default `https://esm.sh`). */
    cdn?: string;
    /** `package.json` to resolve dependency versions from. */
    packageJson?: PackageJsonLike;
}

/** True for a bare specifier — a package import, not a relative/absolute path, URL, or node builtin. */
export function isBareSpecifier(specifier: string): boolean {
    return (
        specifier.length > 0 &&
        !specifier.startsWith('.') &&
        !specifier.startsWith('/') &&
        !specifier.startsWith('node:') &&
        !/^[a-z][a-z0-9+.-]*:/i.test(specifier) // any URL scheme (http:, https:, data:, …)
    );
}

/**
 * The package name of a bare specifier: `lit/decorators.js` -> `lit`,
 * `@lit/reactive-element/decorators.js` -> `@lit/reactive-element`.
 */
export function packageNameOf(specifier: string): string {
    const parts = specifier.split('/');
    if (specifier.startsWith('@')) return parts.slice(0, 2).join('/');
    return parts[0]!;
}

/**
 * A valid npm package name: an optional `@scope/` then url-safe segment chars.
 * Rejects names with whitespace/control chars or an embedded `@version`/tag — so
 * a forged specifier like `lit@evil-tag` can't pin the browser to an
 * attacker-chosen version on the CDN.
 */
export function isValidPackageName(name: string): boolean {
    return /^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(name);
}

/** Extracts every static/dynamic module specifier from a source file's text. */
export function scanSpecifiers(source: string, fileName = 'module.ts'): string[] {
    const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
    const found: string[] = [];

    const visit = (node: ts.Node): void => {
        // import ... from 'x'  /  export ... from 'x'
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            found.push(node.moduleSpecifier.text);
        }
        // import('x')
        if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length > 0 &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
        ) {
            found.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return found;
}

/** Resolves a relative specifier to a file on disk, trying TS/JS extensions and index files. */
function resolveRelative(fromFile: string, specifier: string): string | undefined {
    const base = resolve(dirname(fromFile), specifier);
    const candidates = [base];
    // `./x.js` may be authored for `./x.ts` (ESM-style extensions on TS sources).
    if (base.endsWith('.js')) candidates.push(base.slice(0, -3) + '.ts');
    for (const ext of ['.ts', '.js', '.mjs']) candidates.push(base + ext);
    for (const ext of ['index.ts', 'index.js']) candidates.push(join(base, ext));
    return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

/**
 * Collects the unique, sorted bare import specifiers used by the given module
 * files. With `{ recursive: true }` it follows relative imports to gather bare
 * specifiers across the whole local module graph; otherwise it scans only the
 * listed files. Relative `.css` imports and unresolved relative paths are
 * ignored.
 */
export function collectBareSpecifiers(files: string[], options: { recursive?: boolean } = {}): string[] {
    const bare = new Set<string>();
    const seen = new Set<string>();
    const queue = files.map((f) => resolve(f));

    while (queue.length > 0) {
        const file = queue.shift()!;
        if (seen.has(file)) continue;
        seen.add(file);
        if (!existsSync(file)) continue;

        for (const specifier of scanSpecifiers(readFileSync(file, 'utf8'), file)) {
            if (isBareSpecifier(specifier)) {
                bare.add(specifier);
            } else if (options.recursive && specifier.startsWith('.') && !specifier.endsWith('.css')) {
                const resolved = resolveRelative(file, specifier);
                if (resolved) queue.push(resolved);
            }
        }
    }
    return [...bare].sort();
}

/** Strips a range operator to a concrete version: `^3.1.0` -> `3.1.0`; `workspace:*` -> undefined. */
function pinnedVersion(range: string | undefined): string | undefined {
    if (!range) return undefined;
    const match = /(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?)/.exec(range);
    return match ? match[1] : undefined;
}

function versionFor(pkg: string, packageJson?: PackageJsonLike): string | undefined {
    if (!packageJson) return undefined;
    const range =
        packageJson.dependencies?.[pkg] ??
        packageJson.peerDependencies?.[pkg] ??
        packageJson.devDependencies?.[pkg];
    return pinnedVersion(range);
}

/**
 * Builds an import map from a list of bare specifiers, pinning each package to a
 * CDN (esm.sh by default) at the version declared in `package.json` when known.
 * Each package gets a bare entry (`"lit"`) and a trailing-slash prefix entry
 * (`"lit/"`) so both `import 'lit'` and `import 'lit/decorators.js'` resolve.
 */
export function generateImportMap(specifiers: string[], options: ImportMapOptions = {}): ImportMap {
    const cdn = (options.cdn ?? 'https://esm.sh').replace(/\/$/, '');
    const packages = [...new Set(specifiers.filter(isBareSpecifier).map(packageNameOf))]
        .filter(isValidPackageName) // skip forged/malformed names rather than build a CDN URL from them
        .sort();

    const imports: Record<string, string> = {};
    for (const pkg of packages) {
        const version = versionFor(pkg, options.packageJson);
        const pinned = version ? `${pkg}@${version}` : pkg;
        imports[pkg] = `${cdn}/${pinned}`;
        imports[`${pkg}/`] = `${cdn}/${pinned}/`;
    }
    return { imports };
}

/**
 * Convenience: scan `files` for bare specifiers and build the import map. Reads
 * `./package.json` from the current working directory for versions unless an
 * explicit `packageJson` is supplied.
 */
export function buildImportMap(
    files: string[],
    options: ImportMapOptions & { recursive?: boolean } = {}
): ImportMap {
    const packageJson = options.packageJson ?? readPackageJson();
    const specifiers = collectBareSpecifiers(files, { recursive: options.recursive ?? false });
    const generateOptions: ImportMapOptions = {};
    if (options.cdn !== undefined) generateOptions.cdn = options.cdn;
    if (packageJson !== undefined) generateOptions.packageJson = packageJson;
    return generateImportMap(specifiers, generateOptions);
}

/** Reads `./package.json` from the cwd, or returns undefined when absent/unreadable. */
export function readPackageJson(cwd: string = process.cwd()): PackageJsonLike | undefined {
    const path = resolve(cwd, 'package.json');
    if (!existsSync(path)) return undefined;
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as PackageJsonLike;
    } catch {
        return undefined;
    }
}

/** Renders an import map as a `<script type="importmap">` tag (pretty-printed). */
export function importMapScript(map: ImportMap): string {
    // Escape `<` as the `<` JSON escape so a specifier/URL containing
    // `</script>` (or `<script>`/`<!--`) can't break out of the script element.
    // Still valid JSON, so the import map parses unchanged.
    const json = JSON.stringify(map, null, 2).replace(/</g, '\\u003c');
    return `<script type="importmap">\n${json}\n</script>`;
}

/** Enumerates module files (`.js`/`.mjs` by default) under `dir`, skipping `node_modules`. */
export function findModuleFiles(dir: string, extensions: string[] = ['.js', '.mjs']): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        if (!existsSync(current)) return;
        const entries = readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const full = join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
        }
    };
    walk(resolve(dir));
    return out.sort();
}
