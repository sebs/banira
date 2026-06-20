import type { CompilerOptions } from 'typescript';
import { JSDOM } from 'jsdom';
import { createPrerenderer, type Prerenderer } from './prerender.js';

export interface EleventyPluginOptions {
    /** Component source files to compile and register. */
    files: string[];
    /** Restrict prerendering to these tags (default: every custom element found in `files`). */
    tags?: string[];
    compilerOptions?: CompilerOptions;
    readyTimeout?: number;
}

/** Minimal shape of the Eleventy config object the plugin needs (duck-typed; no eleventy dependency). */
export interface EleventyConfigLike {
    addTransform(
        name: string,
        fn: (this: { outputPath?: string } | void, content: string, outputPath?: string) => string | Promise<string>
    ): void;
    on?(event: string, fn: () => void | Promise<void>): void;
}

/**
 * Rewrites every registered custom element found in `html` into its Declarative
 * Shadow DOM prerendered form, preserving the element's attributes and light-DOM
 * children. Elements already carrying a `<template shadowrootmode>` are left
 * untouched (idempotent). The HTML is parsed inertly (no script execution); only
 * the {@link Prerenderer}'s own window runs component code.
 *
 * Exported so the transform can be unit-tested without Eleventy.
 */
export async function transformHtml(html: string, renderer: Prerenderer, tags: string[] = renderer.tags): Promise<string> {
    // Cheap bail-out: skip the parse/serialize round-trip when no tag is present.
    if (!tags.some((tag) => html.includes(`<${tag}`))) return html;

    const dom = new JSDOM(html); // inert: default options do not run scripts
    const { document } = dom.window;

    for (const tag of tags) {
        for (const element of Array.from(document.querySelectorAll(tag))) {
            if (element.querySelector('template[shadowrootmode]')) continue; // already prerendered
            const attributes: Record<string, string> = {};
            for (const attr of Array.from(element.attributes)) attributes[attr.name] = attr.value;
            const markup = await renderer.renderToString(tag, { attributes, children: element.innerHTML });
            const holder = document.createElement('div');
            holder.innerHTML = markup;
            element.replaceWith(...Array.from(holder.childNodes));
        }
    }
    return dom.serialize();
}

/**
 * An [Eleventy](https://www.11ty.dev/) plugin that prerenders banira components
 * at build time: it registers the components in `options.files` and adds a
 * transform that rewrites matching tags in the generated HTML into Declarative
 * Shadow DOM (the role [WebC](https://github.com/11ty/webc) plays for 11ty),
 * preserving attributes and slotted children. So a vanilla banira component used
 * in an Eleventy template renders — shadow DOM and all — before any JavaScript.
 *
 * Wire it up in `.eleventy.js`:
 * ```js
 * import { createEleventyPlugin } from 'banira';
 * export default function (eleventyConfig) {
 *   eleventyConfig.addPlugin(createEleventyPlugin({ files: ['src/my-circle.ts'] }));
 * }
 * ```
 *
 * The renderer is created lazily on first use and reused across the build, then
 * torn down on Eleventy's `eleventy.after` event.
 */
export function createEleventyPlugin(options: EleventyPluginOptions): (eleventyConfig: EleventyConfigLike) => void {
    return (eleventyConfig: EleventyConfigLike): void => {
        let rendererPromise: Promise<Prerenderer> | undefined;
        const getRenderer = (): Promise<Prerenderer> => {
            if (!rendererPromise) {
                const opts: { compilerOptions?: CompilerOptions; readyTimeout?: number } = {};
                if (options.compilerOptions !== undefined) opts.compilerOptions = options.compilerOptions;
                if (options.readyTimeout !== undefined) opts.readyTimeout = options.readyTimeout;
                rendererPromise = createPrerenderer(options.files, opts);
            }
            return rendererPromise;
        };

        eleventyConfig.addTransform('banira-prerender', async function (content, outputPath) {
            // Eleventy ≥1 exposes this.outputPath; older versions pass it as the 2nd arg.
            const path = outputPath ?? (this ? this.outputPath : undefined);
            if (typeof content !== 'string' || (path && !path.endsWith('.html'))) return content;
            const renderer = await getRenderer();
            return transformHtml(content, renderer, options.tags ?? renderer.tags);
        });

        eleventyConfig.on?.('eleventy.after', async () => {
            if (rendererPromise) (await rendererPromise).close();
        });
    };
}
