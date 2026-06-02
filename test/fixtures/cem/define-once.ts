/** Registration helper (registers a custom element once). */
export function defineOnce(tag: string, ctor: CustomElementConstructor): void {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
}
