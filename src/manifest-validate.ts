import type { Package } from './manifest.js';

export interface ValidationIssue {
    severity: 'error' | 'warning';
    path: string;
    message: string;
}

/** A valid custom-element tag name: lowercase, starts with a letter, contains a hyphen. */
function isCustomElementName(name: string): boolean {
    return /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/.test(name);
}

/**
 * Structurally validates a Custom Elements Manifest against the parts of the
 * 2.1.0 schema that banira emits — without pulling in a JSON-Schema dependency.
 * Returns a list of issues; an empty list means the manifest is well-formed.
 * `error` issues indicate a malformed manifest, `warning` issues flag content
 * that is shaped correctly but likely a mistake (bad tag names, dangling refs).
 */
export function validateManifest(pkg: Package): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const error = (path: string, message: string) => issues.push({ severity: 'error', path, message });
    const warn = (path: string, message: string) => issues.push({ severity: 'warning', path, message });

    if (typeof pkg.schemaVersion !== 'string' || !pkg.schemaVersion) {
        error('schemaVersion', 'missing or non-string schemaVersion');
    }
    if (!Array.isArray(pkg.modules)) {
        error('modules', 'modules must be an array');
        return issues;
    }

    const tagNames = new Map<string, string>();

    pkg.modules.forEach((module, mi) => {
        const mp = `modules[${mi}]`;
        if (module.kind !== 'javascript-module') error(`${mp}.kind`, `unexpected module kind "${module.kind}"`);
        if (!module.path) error(`${mp}.path`, 'module is missing a path');

        const declNames = new Set((module.declarations ?? []).map((d) => d.name));

        (module.declarations ?? []).forEach((decl, di) => {
            const dp = `${mp}.declarations[${di}]`;
            if (decl.kind !== 'class') error(`${dp}.kind`, `unexpected declaration kind "${decl.kind}"`);
            if (!decl.name) error(`${dp}.name`, 'declaration is missing a name');
            if (decl.customElement !== true) error(`${dp}.customElement`, 'customElement must be true');

            if (decl.tagName !== undefined) {
                if (!isCustomElementName(decl.tagName)) {
                    warn(`${dp}.tagName`, `"${decl.tagName}" is not a valid custom element name`);
                }
                const prior = tagNames.get(decl.tagName);
                if (prior) warn(`${dp}.tagName`, `tag name "${decl.tagName}" is also defined by ${prior}`);
                else tagNames.set(decl.tagName, decl.name);
            }

            (decl.members ?? []).forEach((member, xi) => {
                const xp = `${dp}.members[${xi}]`;
                if (member.kind !== 'field' && member.kind !== 'method') {
                    error(`${xp}.kind`, `unexpected member kind "${(member as { kind: string }).kind}"`);
                }
                if (!member.name) error(`${xp}.name`, 'member is missing a name');
                if (!['public', 'private', 'protected'].includes(member.privacy)) {
                    error(`${xp}.privacy`, `invalid privacy "${member.privacy}"`);
                }
            });

            (decl.attributes ?? []).forEach((attr, ai) => {
                if (!attr.name) error(`${dp}.attributes[${ai}].name`, 'attribute is missing a name');
            });

            (decl.events ?? []).forEach((event, ei) => {
                if (!event.name) error(`${dp}.events[${ei}].name`, 'event is missing a name');
            });
        });

        (module.exports ?? []).forEach((exp, ei) => {
            const ep = `${mp}.exports[${ei}]`;
            if (exp.kind !== 'js' && exp.kind !== 'custom-element-definition') {
                error(`${ep}.kind`, `unexpected export kind "${exp.kind}"`);
            }
            const ref = exp.declaration?.name;
            if (ref && !exp.declaration?.module && !declNames.has(ref)) {
                warn(`${ep}.declaration`, `export references unknown local declaration "${ref}"`);
            }
        });
    });

    return issues;
}

/** Formats validation issues as a human-readable report. */
export function formatValidationIssues(issues: ValidationIssue[]): string {
    if (issues.length === 0) return 'Manifest is valid.';
    return issues.map((i) => `${i.severity === 'error' ? 'ERROR' : 'warn '} ${i.path}: ${i.message}`).join('\n');
}
