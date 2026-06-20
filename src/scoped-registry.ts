/**
 * Helpers for scoped custom element registries (#13) — collision-free
 * composition when several libraries (or versions) want the same tag name on one
 * page. Scoped registries are Chromium-only (Chrome/Edge 146+); elsewhere they
 * need the `@webcomponents/scoped-custom-element-registry` polyfill. These
 * helpers feature-detect and fall back to the one global registry, so code that
 * uses them is Baseline-safe and just loses scoping where unsupported.
 *
 * This is the one runtime module banira ships for authors to import; everything
 * else in banira is build-time. Keep it dependency-free and browser-only.
 */

/** The minimal registry surface these helpers rely on. */
export interface RegistryLike {
    get(name: string): unknown;
    define(name: string, ctor: CustomElementConstructor, options?: ElementDefinitionOptions): void;
}

/** The minimal global surface, injectable so the helpers are unit-testable. */
export interface RegistryScope {
    customElements: RegistryLike;
    CustomElementRegistry?: new () => RegistryLike;
}

function globalScope(): RegistryScope {
    return globalThis as unknown as RegistryScope;
}

/**
 * Whether the environment supports scoped registries — i.e. whether
 * `CustomElementRegistry` is constructable. In non-supporting browsers the
 * constructor throws ("Illegal constructor"); with native support or the
 * polyfill it returns a fresh, independent registry.
 */
export function supportsScopedRegistries(scope: RegistryScope = globalScope()): boolean {
    const Ctor = scope.CustomElementRegistry;
    if (typeof Ctor !== 'function') return false;
    try {
        new Ctor();
        return true;
    } catch {
        return false;
    }
}

/**
 * A fresh scoped registry when supported, otherwise the single global registry
 * (so callers degrade to shared, non-scoped behaviour rather than breaking).
 */
export function createScopedRegistry(scope: RegistryScope = globalScope()): RegistryLike {
    return supportsScopedRegistries(scope) ? new scope.CustomElementRegistry!() : scope.customElements;
}

/**
 * Defines `ctor` as `tagName` in `registry` (the global registry by default),
 * skipping the define if the name is already taken in that registry — the
 * collision that scoped registries exist to avoid. Returns the registry used.
 */
export function defineComponent(
    tagName: string,
    ctor: CustomElementConstructor,
    options: { registry?: RegistryLike; definitionOptions?: ElementDefinitionOptions; scope?: RegistryScope } = {}
): RegistryLike {
    const registry = options.registry ?? (options.scope ?? globalScope()).customElements;
    if (!registry.get(tagName)) registry.define(tagName, ctor, options.definitionOptions);
    return registry;
}

/** A host element that can open a shadow root (optionally with a scoped registry). */
export interface ScopedShadowHost {
    attachShadow(init: ShadowRootInit & { registry?: RegistryLike }): ShadowRoot;
}

/**
 * Opens a shadow root bound to `registry` when scoped registries are supported,
 * so elements created inside resolve against that registry. Falls back to a
 * plain `attachShadow(init)` where unsupported.
 */
export function attachScopedShadow(
    host: ScopedShadowHost,
    init: ShadowRootInit,
    registry: RegistryLike,
    scope: RegistryScope = globalScope()
): ShadowRoot {
    return supportsScopedRegistries(scope) ? host.attachShadow({ ...init, registry }) : host.attachShadow(init);
}
