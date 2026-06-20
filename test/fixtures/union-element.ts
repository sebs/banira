/**
 * A button whose attributes are backed by string-literal union properties,
 * used to exercise enum capture across the manifest, types, editor-data and
 * Storybook generators.
 *
 * @summary Button with enumerated size/variant attributes.
 * @fires union-change - Fired when the variant changes, with `detail: { variant }`.
 */
class UnionButton extends HTMLElement {
    /** Visual size of the button. */
    size: 'sm' | 'md' | 'lg' = 'md';

    /** Visual variant. */
    variant: 'primary' | 'secondary' | 'ghost' = 'primary';

    /** Whether the button is disabled. */
    disabled: boolean = false;

    /** A free-form text label. */
    label: string = '';

    static get observedAttributes(): string[] {
        return ['size', 'variant', 'disabled', 'label'];
    }
}

customElements.define('union-button', UnionButton);
