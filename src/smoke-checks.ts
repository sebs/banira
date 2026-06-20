import type { Attribute, NamedDoc } from './manifest.js';

/* These checks run against JSDOM elements, whose types don't line up with the
 * lib.dom globals; a narrow structural type keeps them honest without `any`. */
interface DomElement {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    innerHTML: string;
    shadowRoot: DomShadowRoot | null;
    [member: string]: unknown;
}
interface DomShadowRoot {
    querySelectorAll(selector: string): ArrayLike<DomSlot>;
}
interface DomSlot {
    getAttribute(name: string): string | null;
    assignedNodes(): ArrayLike<unknown>;
}

/** A mismatch between an attribute and its backing property (#39). */
export interface ReflectionIssue {
    attribute: string;
    property: string;
    direction: 'attribute-to-property' | 'property-to-attribute';
    message: string;
}

/** A discrepancy between a component's declared `@slot`s and its shadow `<slot>`s (#40). */
export interface SlotIssue {
    /** The slot name; empty string for the default slot. */
    slot: string;
    kind: 'missing' | 'unassigned' | 'undeclared';
    message: string;
}

function label(name: string): string {
    return name === '' ? '(default)' : `"${name}"`;
}

function show(value: unknown): string {
    if (typeof value === 'string') return JSON.stringify(value);
    return String(value);
}

/**
 * Attribute ↔ property reflection round-trip (#39): for every attribute with a
 * backing property, set the attribute and read the property, then set the
 * property and read the attribute, flagging either direction that doesn't
 * reflect. Sample values are chosen from the attribute's type (boolean presence,
 * a number, or a string / first union value). Only attributes with a `fieldName`
 * (a real backing property) are checked. Mutates the element; intended for a
 * throwaway mounted instance.
 */
export function checkReflection(element: DomElement, attributes: Attribute[]): ReflectionIssue[] {
    const issues: ReflectionIssue[] = [];
    const add = (attr: string, property: string, direction: ReflectionIssue['direction'], message: string): void => {
        issues.push({ attribute: attr, property, direction, message });
    };

    for (const attr of attributes) {
        if (!attr.fieldName) continue; // no backing property → no reflection contract
        const prop = attr.fieldName;
        const type = attr.type?.text;

        try {
            if (type === 'boolean') {
                element.setAttribute(attr.name, '');
                if (element[prop] !== true)
                    add(attr.name, prop, 'attribute-to-property', `setting [${attr.name}] did not make .${prop} true (got ${show(element[prop])})`);
                element.removeAttribute(attr.name);
                try {
                    element[prop] = true;
                    if (!element.hasAttribute(attr.name))
                        add(attr.name, prop, 'property-to-attribute', `.${prop} = true did not add the [${attr.name}] attribute`);
                    element[prop] = false;
                } catch {
                    /* read-only property — skip the property→attribute direction */
                }
            } else if (type === 'number') {
                element.setAttribute(attr.name, '7');
                if (Number(element[prop]) !== 7)
                    add(attr.name, prop, 'attribute-to-property', `setting [${attr.name}]="7" did not make .${prop} 7 (got ${show(element[prop])})`);
                try {
                    element[prop] = 11;
                    if (element.getAttribute(attr.name) !== '11')
                        add(attr.name, prop, 'property-to-attribute', `.${prop} = 11 was not reflected to [${attr.name}] (got ${show(element.getAttribute(attr.name))})`);
                } catch {
                    /* read-only */
                }
            } else {
                const inSample = attr.values?.[0] ?? 'banira-a';
                element.setAttribute(attr.name, inSample);
                if (String(element[prop]) !== inSample)
                    add(attr.name, prop, 'attribute-to-property', `setting [${attr.name}]=${show(inSample)} did not reflect to .${prop} (got ${show(element[prop])})`);
                try {
                    const outSample = attr.values?.[attr.values.length - 1] ?? 'banira-b';
                    element[prop] = outSample;
                    if (element.getAttribute(attr.name) !== outSample)
                        add(attr.name, prop, 'property-to-attribute', `.${prop} = ${show(outSample)} was not reflected to [${attr.name}] (got ${show(element.getAttribute(attr.name))})`);
                } catch {
                    /* read-only */
                }
            }
        } catch {
            /* property access threw — not a reflectable member; skip */
        }
    }
    return issues;
}

/**
 * Slot contract assertions (#40): injects sample light-DOM content targeting
 * each declared `@slot`, then checks that every declared slot has a matching
 * `<slot>` in the (open) shadow root and that the sample content projects into
 * it. Also flags shadow `<slot>`s that aren't documented with `@slot`. Mutates
 * the element's light DOM; intended for a throwaway mounted instance.
 */
export function checkSlots(element: DomElement, slots: NamedDoc[]): SlotIssue[] {
    const issues: SlotIssue[] = [];
    const declared = slots.map((s) => s.name ?? '');

    const shadow = element.shadowRoot;
    if (!shadow) {
        // Without an open shadow root we can't see the slots; only meaningful if any were declared.
        return declared.map((slot) => ({
            slot,
            kind: 'missing' as const,
            message: `declared @slot ${label(slot)} cannot be verified: no open shadow root`,
        }));
    }

    // Inject one sample node per declared slot so we can assert it projects.
    // Escape the slot name (it's author-controlled jsdoc) so an odd `@slot` name
    // can't break out of the injected attribute.
    const escapeAttr = (s: string): string =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    element.innerHTML = declared
        .map((name) => (name === '' ? '<span>default</span>' : `<span slot="${escapeAttr(name)}">x</span>`))
        .join('');

    const slotEls = Array.from(shadow.querySelectorAll('slot'));
    const presentNames = new Set(slotEls.map((s) => s.getAttribute('name') ?? ''));

    for (const name of declared) {
        if (!presentNames.has(name)) {
            issues.push({ slot: name, kind: 'missing', message: `declared @slot ${label(name)} has no matching <slot> in the shadow root` });
            continue;
        }
        const slotEl = slotEls.find((s) => (s.getAttribute('name') ?? '') === name)!;
        if (slotEl.assignedNodes().length === 0) {
            issues.push({ slot: name, kind: 'unassigned', message: `sample content for slot ${label(name)} did not project (assignedNodes is empty)` });
        }
    }

    for (const name of presentNames) {
        if (!declared.includes(name)) {
            issues.push({ slot: name, kind: 'undeclared', message: `<slot${name ? ` name="${name}"` : ''}> exists but is not documented with @slot` });
        }
    }

    return issues;
}
