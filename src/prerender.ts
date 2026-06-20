import type { CompilerOptions } from 'typescript';
import { JSDOM } from 'jsdom';
import { Compiler } from './compiler.js';
import { ManifestGenerator } from './manifest.js';
import { TestHelper } from './test-helper.js';
import { bundleModule } from './module-bundler.js';

export interface PrerenderResult {
    tagName: string;
    file: string;
    /** The element's serialized markup, including a Declarative Shadow DOM template when it has a shadow root. */
    html: string;
}

export interface PrerenderOptions {
    compilerOptions?: CompilerOptions;
    /** Attributes to set on each prerendered element. */
    attributes?: Record<string, string>;
    readyTimeout?: number;
    /**
     * Inline the component's constructable stylesheet(s) into the DSD template as
     * a `<style data-banira-critical>` so the prerendered markup is styled before
     * JS (FOUC-free). Default `true`. On hydration, {@link hydrateShadow} drops
     * this inline style once it adopts the (deduped) constructable sheet.
     */
    inlineStyles?: boolean;
}

/** A syntactically valid custom-element tag name (lowercase, starts with a letter, has a hyphen). */
function isValidTagName(tagName: string): boolean {
    return /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/.test(tagName);
}

/** A safe HTML attribute name (no whitespace, quotes, `>`, `/`, `=` or controls). */
function isValidAttributeName(name: string): boolean {
    return /^[A-Za-z_:][A-Za-z0-9_:.-]*$/.test(name);
}

/** HTML-escapes an attribute value for a double-quoted context. */
function escapeAttributeValue(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Serializes attributes into an HTML attribute string (leading space per
 * attribute). Attribute **names** are validated (entries with an unsafe name are
 * dropped, since they can't be represented without breaking out of the tag) and
 * values are HTML-escaped — so attacker-influenced attributes can't inject markup.
 */
function attributeString(attributes: Record<string, string>): string {
    return Object.entries(attributes)
        .filter(([k]) => isValidAttributeName(k))
        .map(([k, v]) => ` ${k}="${escapeAttributeValue(v)}"`)
        .join('');
}

/** Serializes a shadow root's adopted constructable stylesheets to a critical-CSS `<style>` (#44). */
function criticalStyles(shadow: { adoptedStyleSheets?: ArrayLike<{ cssRules: ArrayLike<{ cssText: string }> }> }): string {
    let css = '';
    for (const sheet of Array.from(shadow.adoptedStyleSheets ?? [])) {
        try {
            for (const rule of Array.from(sheet.cssRules)) css += rule.cssText;
        } catch {
            /* ignore unreadable sheet */
        }
    }
    if (!css) return '';
    // A CSS string value can contain `</style>` (e.g. `content: "</style>…"`),
    // which would otherwise close the inlined <style> and inject markup. Escape
    // the `</` — `\/` is an inert CSS escape for `/`, so the rendered CSS is
    // unchanged but the HTML parser no longer sees a closing tag.
    return `<style data-banira-critical>${css.replace(/<\//g, '<\\/')}</style>`;
}

/**
 * Wraps shadow-root markup in a Declarative Shadow DOM template for `tagName`.
 * Any `children` (light-DOM HTML) are placed after the template, inside the
 * host, so they project into the component's slots on the client.
 */
export function declarativeShadowDom(
    tagName: string,
    shadowHtml: string,
    attributes: Record<string, string> = {},
    children: string = ''
): string {
    if (!isValidTagName(tagName)) {
        throw new Error(`Invalid custom element tag name: ${JSON.stringify(tagName)}`);
    }
    return `<${tagName}${attributeString(attributes)}><template shadowrootmode="open">${shadowHtml}</template>${children}</${tagName}>`;
}

/** Options for a single {@link Prerenderer.renderToString} call. */
export interface RenderToStringOptions {
    /** Attributes to set on the host element. */
    attributes?: Record<string, string>;
    /** Light-DOM children (HTML) placed inside the host, projected into slots. */
    children?: string;
}

export interface PrerendererOptions {
    compilerOptions?: CompilerOptions;
    /** Upper bound (ms) on waiting for a component to register/settle. */
    readyTimeout?: number;
    /** Inline adopted constructable stylesheets as critical CSS in the DSD template (default `true`). See #44. */
    inlineStyles?: boolean;
}

/**
 * A reusable server-side renderer over a fixed set of component sources: the
 * components are compiled and registered once, then {@link renderToString} can
 * be called repeatedly (by tag) to produce Declarative Shadow DOM markup. This
 * is the stable primitive meta-frameworks (Enhance/WebC/11ty/Rocket) call.
 */
export interface Prerenderer {
    /** The custom-element tag names registered in this renderer. */
    readonly tags: string[];
    /** Renders one element to DSD markup (host + `<template shadowrootmode>` + light-DOM children). */
    renderToString(tagName: string, options?: RenderToStringOptions): Promise<string>;
    /** Tears down the underlying JSDOM window. Call when finished. */
    close(): void;
}

/**
 * Compiles and registers the components in `files` into a single JSDOM window
 * and returns a {@link Prerenderer} whose `renderToString(tag, { attributes,
 * children })` serializes any of them to Declarative Shadow DOM on demand —
 * the SSR entry point for meta-framework adapters (see {@link createEleventyPlugin}).
 */
export async function createPrerenderer(files: string[], options: PrerendererOptions = {}): Promise<Prerenderer> {
    const compilerOptions = options.compilerOptions ?? Compiler.DEFAULT_COMPILER_OPTIONS;
    const readyTimeout = options.readyTimeout ?? 1000;
    const inlineStyles = options.inlineStyles ?? true;

    const pkg = new ManifestGenerator(files, compilerOptions).generate();
    const tags = pkg.modules
        .flatMap((m) => m.declarations)
        .map((d) => d.tagName)
        .filter((t): t is string => Boolean(t));

    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        runScripts: 'dangerously',
        resources: 'usable',
    });
    const { window } = dom;
    const { document } = window;

    for (const file of files) {
        const script = document.createElement('script');
        script.textContent = bundleModule(file, compilerOptions);
        document.head.appendChild(script);
    }

    const waitDefined = async (tagName: string): Promise<void> => {
        await Promise.race([
            window.customElements.whenDefined(tagName),
            new Promise<void>((resolve) => window.setTimeout(resolve, readyTimeout)),
        ]);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    };

    const renderToString = async (tagName: string, opts: RenderToStringOptions = {}): Promise<string> => {
        const attributes = opts.attributes ?? {};
        const children = opts.children ?? '';
        await waitDefined(tagName);

        const element = document.createElement(tagName);
        for (const [k, v] of Object.entries(attributes)) element.setAttribute(k, v);
        if (children) element.innerHTML = children;
        document.body.appendChild(element);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0)); // let render settle

        const shadow = (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        const shadowHtml = shadow ? (inlineStyles ? criticalStyles(shadow) : '') + shadow.innerHTML.trim() : '';
        const markup = shadow
            ? declarativeShadowDom(tagName, shadowHtml, attributes, children)
            : `<${tagName}${attributeString(attributes)}>${children}</${tagName}>`;
        element.remove();
        return markup;
    };

    return { tags, renderToString, close: () => window.close() };
}

/**
 * Renders each custom element in the given sources to static HTML using
 * Declarative Shadow DOM (`<template shadowrootmode="open">`), the
 * Baseline-supported primitive for server-rendering shadow DOM with no
 * JavaScript. Components are mounted in JSDOM (via {@link TestHelper}) and their
 * shadow root is serialized. Elements without a shadow root are emitted as a
 * plain tag. Returns one {@link PrerenderResult} per element.
 */
export async function prerenderManifest(files: string[], options: PrerenderOptions = {}): Promise<PrerenderResult[]> {
    const compilerOptions = options.compilerOptions ?? Compiler.DEFAULT_COMPILER_OPTIONS;
    const inlineStyles = options.inlineStyles ?? true;
    const generator = new ManifestGenerator(files, compilerOptions);
    const pkg = generator.generate();
    const results: PrerenderResult[] = [];

    for (const module of pkg.modules) {
        for (const decl of module.declarations) {
            if (!decl.tagName) continue;
            const helper = new TestHelper();
            if (options.readyTimeout !== undefined) helper.readyTimeout = options.readyTimeout;
            const context = await helper.compileAndMountAsScript(
                decl.tagName,
                module.path,
                compilerOptions,
                options.attributes
            );
            const element = context.document.querySelector(decl.tagName);
            const shadow = (element as Element & { shadowRoot?: ShadowRoot | null })?.shadowRoot;
            const shadowHtml = shadow ? (inlineStyles ? criticalStyles(shadow) : '') + shadow.innerHTML.trim() : '';
            const html = shadow
                ? declarativeShadowDom(decl.tagName, shadowHtml, options.attributes)
                : `<${decl.tagName}></${decl.tagName}>`;
            results.push({ tagName: decl.tagName, file: module.path, html });
            context.jsdom.window.close();
        }
    }

    return results;
}
