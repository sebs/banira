import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    supportsScopedRegistries,
    createScopedRegistry,
    defineComponent,
    attachScopedShadow,
    type RegistryLike,
    type RegistryScope,
} from '../src/index.js';

/** A Map-backed registry standing in for a CustomElementRegistry. */
function fakeRegistry(): RegistryLike & { defined: Map<string, unknown> } {
    const defined = new Map<string, unknown>();
    return {
        defined,
        get: (name) => defined.get(name),
        define: (name, ctor) => {
            if (defined.has(name)) throw new Error(`'${name}' already defined`);
            defined.set(name, ctor);
        },
    };
}

/** A scope where `new CustomElementRegistry()` is allowed (scoped-registry support). */
function supportingScope(): RegistryScope {
    return {
        customElements: fakeRegistry(),
        CustomElementRegistry: function () {
            return fakeRegistry();
        } as unknown as new () => RegistryLike,
    };
}

/** A scope where the constructor throws — the legacy "Illegal constructor" world. */
function legacyScope(): RegistryScope {
    return {
        customElements: fakeRegistry(),
        CustomElementRegistry: function () {
            throw new Error('Illegal constructor');
        } as unknown as new () => RegistryLike,
    };
}

const Ctor = class {} as unknown as CustomElementConstructor;

describe('scoped registries (issue #13)', () => {
    it('detects support via constructability', () => {
        assert.strictEqual(supportsScopedRegistries(supportingScope()), true);
        assert.strictEqual(supportsScopedRegistries(legacyScope()), false);
        assert.strictEqual(supportsScopedRegistries({ customElements: fakeRegistry() }), false);
    });

    it('createScopedRegistry returns a fresh registry when supported', () => {
        const scope = supportingScope();
        const reg = createScopedRegistry(scope);
        assert.notStrictEqual(reg, scope.customElements, 'should be a new registry, not the global one');
    });

    it('createScopedRegistry falls back to the global registry when unsupported', () => {
        const scope = legacyScope();
        assert.strictEqual(createScopedRegistry(scope), scope.customElements);
    });

    it('defineComponent defines into the given registry and skips collisions', () => {
        const registry = fakeRegistry();
        defineComponent('x-a', Ctor, { registry });
        assert.ok(registry.get('x-a'));
        // Second define for the same name must not throw (collision avoided).
        assert.doesNotThrow(() => defineComponent('x-a', Ctor, { registry }));
    });

    it('defineComponent targets the scope global registry by default', () => {
        const scope = supportingScope();
        defineComponent('x-b', Ctor, { scope });
        assert.ok(scope.customElements.get('x-b'));
    });

    it('attachScopedShadow passes the registry when supported', () => {
        const registry = fakeRegistry();
        let received: unknown;
        const host = { attachShadow: (init: unknown) => ((received = init), {} as ShadowRoot) };
        attachScopedShadow(host, { mode: 'open' }, registry, supportingScope());
        assert.deepStrictEqual(received, { mode: 'open', registry });
    });

    it('attachScopedShadow omits the registry when unsupported', () => {
        const registry = fakeRegistry();
        let received: unknown;
        const host = { attachShadow: (init: unknown) => ((received = init), {} as ShadowRoot) };
        attachScopedShadow(host, { mode: 'open' }, registry, legacyScope());
        assert.deepStrictEqual(received, { mode: 'open' });
    });
});
