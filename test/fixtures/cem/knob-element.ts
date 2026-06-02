import { ValueElement } from './value-element.js';

/**
 * A knob control that extends a custom intermediate base class (issue #4).
 */
class KnobElement extends ValueElement {
    /** Label shown under the knob. */
    format: string = 'percent';

    static get observedAttributes(): string[] {
        return [...ValueElement.valueAttributes, 'reset', 'format', 'unit'];
    }
}

customElements.define('knob-element', KnobElement);
