import { emit } from './emit-util.js';

/**
 * A component that dispatches its events through a shared `emit()` helper (issue #5).
 * @fires change - Fired when the committed value changes
 */
class EmitterElement extends HTMLElement {
    private commit(value: number): void {
        emit(this, 'input', { value });
        emit(this, 'change', { value });
    }
}

customElements.define('emitter-element', EmitterElement);
