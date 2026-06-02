/** Shared dispatch helper: emits a bubbling, composed CustomEvent (issue #5). */
export function emit<T>(el: HTMLElement, type: string, detail: T): void {
    el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}
