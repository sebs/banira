import type { ClassMember, CustomElementDeclaration, Package } from './manifest.js';

export type ChangeKind = 'added' | 'removed' | 'changed';
export type ReleaseType = 'major' | 'minor' | 'patch';
/** The collection a member-level change belongs to. */
export type ChangeGroup = 'attributes' | 'events' | 'members';

export interface Change {
    kind: ChangeKind;
    /** Dotted path to the changed entity, e.g. `my-button.attributes.disabled`. */
    path: string;
    detail: string;
    /** Tag name (or class name) of the element the change belongs to. */
    element: string;
    /** Collection of a member-level change; absent when the element itself was added/removed. */
    group?: ChangeGroup;
    /** Name of the attribute/event/member; absent for element-level changes. */
    name?: string;
    /** Previous type signature of a `changed` entry. */
    from?: string;
    /** New type signature of a `changed` entry. */
    to?: string;
}

export interface ManifestDiff {
    changes: Change[];
    /** Suggested semver bump: `major` for removals/type changes, `minor` for additions, `patch` otherwise. */
    release: ReleaseType;
}

/** Indexes declarations by tagName (falling back to class name) for comparison. */
function byKey(pkg: Package): Map<string, CustomElementDeclaration> {
    const map = new Map<string, CustomElementDeclaration>();
    // Tolerate a malformed module/declaration shape (the CLI diff JSON.parses
    // arbitrary files): skip rather than crash on a missing array. See finding #26.
    for (const module of Array.isArray(pkg.modules) ? pkg.modules : []) {
        for (const decl of module?.declarations ?? []) {
            map.set(decl.tagName ?? decl.name, decl);
        }
    }
    return map;
}

function indexBy<T extends { name: string }>(items: T[] | undefined): Map<string, T> {
    return new Map((items ?? []).map((i) => [i.name, i]));
}

function memberSignature(member: ClassMember): string {
    if (member.kind === 'field') return member.type?.text ?? 'unknown';
    const params = (member.parameters ?? []).map((p) => p.type?.text ?? 'unknown').join(', ');
    return `(${params}) => ${member.return?.type?.text ?? 'void'}`;
}

/** Compares one named collection (attributes/events/members) between two declarations. */
function diffCollection<T extends { name: string }>(
    tag: string,
    group: ChangeGroup,
    before: T[] | undefined,
    after: T[] | undefined,
    signatureOf: (item: T) => string,
    changes: Change[]
): void {
    const oldItems = indexBy(before);
    const newItems = indexBy(after);
    for (const [name, item] of newItems) {
        if (!oldItems.has(name)) {
            changes.push({
                kind: 'added',
                path: `${tag}.${group}.${name}`,
                detail: `added ${group} "${name}"`,
                element: tag,
                group,
                name,
            });
        } else {
            const oldSig = signatureOf(oldItems.get(name)!);
            const newSig = signatureOf(item);
            if (oldSig !== newSig) {
                changes.push({
                    kind: 'changed',
                    path: `${tag}.${group}.${name}`,
                    detail: `${group} "${name}" type changed: ${oldSig} → ${newSig}`,
                    element: tag,
                    group,
                    name,
                    from: oldSig,
                    to: newSig,
                });
            }
        }
    }
    for (const [name] of oldItems) {
        if (!newItems.has(name)) {
            changes.push({
                kind: 'removed',
                path: `${tag}.${group}.${name}`,
                detail: `removed ${group} "${name}"`,
                element: tag,
                group,
                name,
            });
        }
    }
}

/**
 * Diffs two Custom Elements Manifests and suggests a semver release type.
 * Removals and type changes are breaking (`major`); pure additions are `minor`;
 * an empty diff is `patch`.
 */
export function diffManifests(before: Package, after: Package): ManifestDiff {
    for (const [label, pkg] of [['before', before], ['after', after]] as const) {
        if (!pkg || !Array.isArray(pkg.modules)) {
            throw new Error(`diffManifests: the "${label}" manifest is malformed (expected a { modules: [...] } object).`);
        }
    }
    const changes: Change[] = [];
    const oldDecls = byKey(before);
    const newDecls = byKey(after);

    for (const [key, decl] of newDecls) {
        if (!oldDecls.has(key)) {
            changes.push({ kind: 'added', path: key, detail: `added element "${key}"`, element: key });
            continue;
        }
        const prev = oldDecls.get(key)!;
        diffCollection(key, 'attributes', prev.attributes, decl.attributes, (a) => a.type?.text ?? 'unknown', changes);
        diffCollection(key, 'events', prev.events, decl.events, (e) => e.type?.text ?? 'unknown', changes);
        diffCollection(key, 'members', prev.members, decl.members, memberSignature, changes);
    }
    for (const [key] of oldDecls) {
        if (!newDecls.has(key)) {
            changes.push({ kind: 'removed', path: key, detail: `removed element "${key}"`, element: key });
        }
    }

    let release: ReleaseType = 'patch';
    if (changes.some((c) => c.kind === 'removed' || c.kind === 'changed')) release = 'major';
    else if (changes.some((c) => c.kind === 'added')) release = 'minor';

    return { changes, release };
}

/** Formats a diff as a human-readable report. */
export function formatManifestDiff(diff: ManifestDiff): string {
    if (diff.changes.length === 0) return 'No API changes. (patch)';
    const symbols: Record<ChangeKind, string> = { added: '+', removed: '-', changed: '~' };
    const lines = diff.changes.map((c) => `${symbols[c.kind]} ${c.detail}`);
    return `${lines.join('\n')}\n\nSuggested release: ${diff.release}`;
}

export interface ChangelogOptions {
    /** Text of the `##` release heading (default `Unreleased`); the suggested bump is appended. */
    heading?: string;
}

const CHANGELOG_SECTIONS: [ChangeKind, string][] = [
    ['added', 'Added'],
    ['changed', 'Changed'],
    ['removed', 'Removed'],
];

const CHANGELOG_GROUPS: [ChangeGroup | undefined, string][] = [
    [undefined, 'Elements'],
    ['attributes', 'Attributes'],
    ['events', 'Events'],
    ['members', 'Properties & methods'],
];

/** Renders an element key as `<tag>` when it is a custom-element name, else as the bare class name. */
function elementLabel(key: string): string {
    return key.includes('-') ? `\`<${key}>\`` : `\`${key}\``;
}

function changelogEntry(change: Change): string {
    if (!change.group) return `- ${elementLabel(change.element)}`;
    const entry = `- ${elementLabel(change.element)} \`${change.name}\``;
    return change.kind === 'changed' ? `${entry}: \`${change.from}\` → \`${change.to}\`` : entry;
}

/**
 * Renders a diff as a paste-ready Markdown changelog block: a release heading
 * carrying the suggested semver bump, then `### Added / Changed / Removed`
 * sections grouped by elements, attributes, events and properties/methods.
 */
export function formatChangelog(diff: ManifestDiff, options: ChangelogOptions = {}): string {
    const blocks = [`## ${options.heading ?? 'Unreleased'} (${diff.release})`];
    if (diff.changes.length === 0) blocks.push('No API changes.');

    for (const [kind, title] of CHANGELOG_SECTIONS) {
        const ofKind = diff.changes.filter((c) => c.kind === kind);
        if (ofKind.length === 0) continue;
        blocks.push(`### ${title}`);
        for (const [group, groupTitle] of CHANGELOG_GROUPS) {
            const entries = ofKind.filter((c) => c.group === group).map(changelogEntry);
            if (entries.length > 0) blocks.push(`#### ${groupTitle}`, entries.join('\n'));
        }
    }
    return `${blocks.join('\n\n')}\n`;
}
