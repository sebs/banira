import * as ts from 'typescript';
import { relative, isAbsolute } from 'path';

/**
 * Browser error overlay for the dev loop (#46): compile errors are pushed over
 * the live-reload SSE channel as an `error:<json>` message and rendered as a
 * full-screen overlay in the page, instead of only being logged to the terminal.
 */

/** One compile error as shown in the overlay — the JSON shape of an `error:` message. */
export interface OverlayDiagnostic {
    /** Source file, relative to the working directory when inside it. */
    file?: string;
    /** 1-based line. */
    line?: number;
    /** 1-based column. */
    column?: number;
    message: string;
}

/** The overlay runtime installed in the page. */
export interface ErrorOverlay {
    /** Renders (or replaces) the overlay with the given diagnostics. */
    show(diagnostics: OverlayDiagnostic[]): void;
    /** Removes the overlay, if shown. */
    clear(): void;
}

/** Converts TypeScript diagnostics into the structured {@link OverlayDiagnostic} shape. */
export function toOverlayDiagnostics(
    diagnostics: readonly ts.Diagnostic[],
    cwd: string = process.cwd()
): OverlayDiagnostic[] {
    return diagnostics.map((diagnostic) => {
        const item: OverlayDiagnostic = { message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') };
        if (diagnostic.file) {
            const rel = relative(cwd, diagnostic.file.fileName);
            item.file = rel.startsWith('..') || isAbsolute(rel) ? diagnostic.file.fileName : rel;
            if (diagnostic.start !== undefined) {
                const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
                item.line = line + 1;
                item.column = character + 1;
            }
        }
        return item;
    });
}

/**
 * Builds the `error:<json>` SSE payload the server pushes for failed compiles.
 * `JSON.stringify` escapes newlines, so the payload fits on one SSE `data:` line.
 */
export function errorOverlayMessage(diagnostics: OverlayDiagnostic[]): string {
    return `error:${JSON.stringify(diagnostics)}`;
}

/**
 * Installs the overlay runtime on `win` (idempotent) and returns it.
 *
 * Written to be both callable directly (jsdom tests) and serializable via
 * `Function.prototype.toString()` for browser injection — so it must not
 * reference any module-scope binding. The overlay lives in a shadow root so page
 * styles can't break it (and it can't leak styles into the page), and every
 * diagnostic is rendered with `textContent`, never as HTML.
 */
export function installErrorOverlay(win: Window & { __baniraErrorOverlay?: ErrorOverlay }): ErrorOverlay {
    if (win.__baniraErrorOverlay) return win.__baniraErrorOverlay;
    const doc = win.document;
    let host: HTMLElement | null = null;

    const el = (tag: string, className: string, text?: string): HTMLElement => {
        const node = doc.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const clear = (): void => {
        if (host) host.remove();
        host = null;
    };

    const show = (diagnostics: OverlayDiagnostic[]): void => {
        clear();
        host = doc.createElement('div');
        host.setAttribute('data-banira-error-overlay', '');
        const root = host.attachShadow({ mode: 'open' });

        const style = doc.createElement('style');
        style.textContent = [
            ':host { all: initial; position: fixed; inset: 0; z-index: 2147483647; }',
            '.backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.66); overflow: auto; padding: 5vh 16px; box-sizing: border-box; }',
            '.panel { max-width: 960px; margin: 0 auto; background: #1e1e24; color: #f0f0f0; border-top: 4px solid #ff5555; border-radius: 6px; padding: 20px 24px; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); }',
            '.head { display: flex; justify-content: space-between; align-items: center; gap: 16px; }',
            '.title { margin: 0; font-size: 16px; color: #ff7777; }',
            '.close { all: unset; cursor: pointer; padding: 2px 10px; border-radius: 4px; color: #ccc; font-size: 18px; }',
            '.close:hover, .close:focus-visible { background: #33333d; color: #fff; }',
            '.list { list-style: none; margin: 16px 0; padding: 0; }',
            '.item { margin: 0 0 16px; }',
            '.loc { color: #8ab4f8; }',
            '.msg { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; font: inherit; }',
            '.hint { margin: 0; color: #999; font-size: 12px; }',
        ].join('\n');

        const panel = el('div', 'panel');
        panel.setAttribute('role', 'alertdialog');
        panel.setAttribute('aria-label', 'Compilation errors');

        const head = el('div', 'head');
        const count = diagnostics.length;
        head.appendChild(el('h2', 'title', `Compilation failed: ${count} error${count === 1 ? '' : 's'}`));
        const close = el('button', 'close', '×');
        close.setAttribute('aria-label', 'Dismiss');
        close.addEventListener('click', clear);
        head.appendChild(close);
        panel.appendChild(head);

        const list = el('ul', 'list');
        for (const d of diagnostics) {
            const item = el('li', 'item');
            if (d.file) {
                const where = d.line !== undefined ? `${d.file}:${d.line}:${d.column ?? 1}` : d.file;
                item.appendChild(el('div', 'loc', where));
            }
            item.appendChild(el('pre', 'msg', d.message));
            list.appendChild(item);
        }
        panel.appendChild(list);
        panel.appendChild(el('p', 'hint', 'Fix the error and save — this clears on the next successful compile. Esc to dismiss.'));

        const backdrop = el('div', 'backdrop');
        backdrop.appendChild(panel);
        root.appendChild(style);
        root.appendChild(backdrop);
        (doc.body || doc.documentElement).appendChild(host);
        close.focus();
    };

    doc.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape') clear();
    });

    const api: ErrorOverlay = { show, clear };
    Object.defineProperty(win, '__baniraErrorOverlay', { value: api });
    return api;
}

/**
 * Browser snippet that installs the overlay runtime as `__baniraOverlay`. Meant
 * to be placed inside a block (`{ … }`) with the SSE handler that uses it, so the
 * binding doesn't leak into a classic script's global scope.
 */
export const ERROR_OVERLAY_SCRIPT = `const __baniraOverlay = (${installErrorOverlay.toString()})(window);`;
