/**
 * A themed widget with several CSS custom properties (issue #11).
 * @cssprop [--knob-size=48px] - Diameter of the knob
 * @cssprop [--knob-active-color=#0a7] - Color of the active arc
 * @cssprop --knob-track-color - Color of the inactive track
 * @cssprop [--label-color=#333] - Color of the label text
 * @cssprop [--gap=8px] - Spacing between knob and label
 */
class ThemedElement extends HTMLElement {}

customElements.define('themed-element', ThemedElement);
