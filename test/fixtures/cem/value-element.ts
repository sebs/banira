/** Intermediate base class shared by the value-style controls (issue #4). */
export abstract class ValueElement extends HTMLElement {
    /** Attributes shared by every value control. */
    static readonly valueAttributes = ['value', 'min', 'max', 'step', 'disabled', 'scale'];

    /** The current value. */
    value: number = 0;

    /** The smallest accepted value. */
    min: number = 0;

    /** Clamps and stores the given value. */
    setValue(next: number): void {
        this.value = next;
    }
}
