import { BaseElement } from './base-element.js';
import { defineOnce } from './define-once.js';

/**
 * A widget that extends a base class and registers via a helper.
 * @slot label - the widget label
 */
class MyWidget extends BaseElement {
    /** The widget size. */
    size: number = 1;

    static get observedAttributes() {
        return ['size'];
    }
}

defineOnce('my-widget', MyWidget);
