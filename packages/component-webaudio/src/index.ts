// Side-effect import: registers the <wa-knob> custom element.
// The component file self-registers via customElements.define so it can also be
// loaded directly as a classic script; this barrel makes the package importable.
import './wa-knob.js';

export {};
