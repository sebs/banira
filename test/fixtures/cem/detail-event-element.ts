/**
 * A component whose events carry typed detail payloads (issue #16).
 * @fires {{ ratio: number }} resize - Fired when the widget is resized
 */
class DetailEventElement extends HTMLElement {
    private commit(value: number): void {
        // Generic type argument carries the detail payload type.
        this.dispatchEvent(new CustomEvent<{ value: number }>('change', { detail: { value } }));
        // A plain event keeps a bare constructor type (no detail).
        this.dispatchEvent(new Event('input'));
    }
}

customElements.define('detail-event-element', DetailEventElement);
