/**
 * A fully documented rating widget used to exercise the manifest analyzer.
 *
 * @slot - Default slot for the label
 * @slot icon - Slot for a custom rating icon
 * @csspart star - The individual star element
 * @cssprop --rating-color - Color of the active stars
 * @fires rating-change - Fired when the rating changes
 */
class RatingWidget extends HTMLElement {
    /** The maximum number of stars. */
    max: number = 5;

    private _value: number = 0;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['value', 'max'];
    }

    /** The current rating value. */
    get value(): number {
        return this._value;
    }

    set value(next: number) {
        this._value = next;
        this.dispatchEvent(new CustomEvent('rating-change', { detail: { value: next } }));
    }

    /** The label text. @deprecated use a slot instead */
    label: string = '';

    /** A computed read-only summary of the current rating. */
    get summary(): string {
        return `${this._value} / ${this.max}`;
    }

    /**
     * Sets the rating to a specific star.
     * @param star the star index to select
     * @param animate whether to animate the change
     * @returns the clamped value that was applied
     */
    setRating(star: number, animate?: boolean): number {
        this.value = star;
        return this.value;
    }

    /** Resets the rating back to zero. */
    reset(): void {
        this.value = 0;
    }

    /** @internal test-only hook that must not appear in the manifest */
    debugDump(): void {
        /* no-op */
    }

    private render(): void {
        /* no-op for the fixture */
    }
}

customElements.define('rating-widget', RatingWidget);
