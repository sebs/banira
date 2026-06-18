import type { ClassMember, CustomElementDeclaration, Package } from './manifest.js';

export type ChangeKind = 'added' | 'removed' | 'changed';
export type ReleaseType = 'major' | 'minor' | 'patch';

export interface Change {
    kind: ChangeKind;
    /** Dotted path to the changed entity, e.g. `my-button.attributes.disabled`. */
    path: string;
    detail: string;
}

export interface ManifestDiff {
    changes: Change[];
    /** Suggested semver bump: `major` for removals/type changes, `minor` for additions, `patch` otherwise. */
    release: ReleaseType;
}

/** Indexes declarations by tagName (falling back to class name) for comparison. */
function byKey(pkg: Package): Map<string, CustomElementDeclaration> {
    const map = new Map<string, CustomElementDeclaration>();
    for (const decl of pkg.modules.flatMap((m) => m.declarations)) {
        map.set(decl.tagName ?? decl.name, decl);
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
    group: string,
    before: T[] | undefined,
    after: T[] | undefined,
    signatureOf: (item: T) => string,
    changes: Change[]
): void {
    const oldItems = indexBy(before);
    const newItems = indexBy(after);
    for (const [name, item] of newItems) {
        if (!oldItems.has(name)) {
            changes.push({ kind: 'added', path: `${tag}.${group}.${name}`, detail: `added ${group} "${name}"` });
        } else {
            const oldSig = signatureOf(oldItems.get(name)!);
            const newSig = signatureOf(item);
            if (oldSig !== newSig) {
                changes.push({
                    kind: 'changed',
                    path: `${tag}.${group}.${name}`,
                    detail: `${group} "${name}" type changed: ${oldSig} → ${newSig}`,
                });
            }
        }
    }
    for (const [name] of oldItems) {
        if (!newItems.has(name)) {
            changes.push({ kind: 'removed', path: `${tag}.${group}.${name}`, detail: `removed ${group} "${name}"` });
        }
    }
}

/**
 * Diffs two Custom Elements Manifests and suggests a semver release type.
 * Removals and type changes are breaking (`major`); pure additions are `minor`;
 * an empty diff is `patch`.
 */
export function diffManifests(before: Package, after: Package): ManifestDiff {
    const changes: Change[] = [];
    const oldDecls = byKey(before);
    const newDecls = byKey(after);

    for (const [key, decl] of newDecls) {
        if (!oldDecls.has(key)) {
            changes.push({ kind: 'added', path: key, detail: `added element "${key}"` });
            continue;
        }
        const prev = oldDecls.get(key)!;
        diffCollection(key, 'attributes', prev.attributes, decl.attributes, (a) => a.type?.text ?? 'unknown', changes);
        diffCollection(key, 'events', prev.events, decl.events, (e) => e.type?.text ?? 'unknown', changes);
        diffCollection(key, 'members', prev.members, decl.members, memberSignature, changes);
    }
    for (const [key] of oldDecls) {
        if (!newDecls.has(key)) changes.push({ kind: 'removed', path: key, detail: `removed element "${key}"` });
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
