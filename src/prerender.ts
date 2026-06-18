import type { CompilerOptions } from 'typescript';
import { Compiler } from './compiler.js';
import { ManifestGenerator } from './manifest.js';
import { TestHelper } from './test-helper.js';

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
}

/** Wraps shadow-root markup in a Declarative Shadow DOM template for `tagName`. */
export function declarativeShadowDom(tagName: string, shadowHtml: string, attributes: Record<string, string> = {}): string {
    const attrs = Object.entries(attributes)
        .map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`)
        .join('');
    return `<${tagName}${attrs}><template shadowrootmode="open">${shadowHtml}</template></${tagName}>`;
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
            const html = shadow
                ? declarativeShadowDom(decl.tagName, shadow.innerHTML.trim(), options.attributes)
                : `<${decl.tagName}></${decl.tagName}>`;
            results.push({ tagName: decl.tagName, file: module.path, html });
            context.jsdom.window.close();
        }
    }

    return results;
}
