/**
 * `@banira/component-aux` — clean-room vanilla web components for audio UIs.
 *
 * Importing this module registers every `aux-*` custom element as a side effect
 * and re-exports the widget classes and core utilities for programmatic use.
 */

// Widgets (each module self-registers its custom element).
export { AuxKnob } from './widgets/aux-knob.js';
export { AuxFader } from './widgets/aux-fader.js';
export { AuxSlider } from './widgets/aux-slider.js';
export { AuxButton } from './widgets/aux-button.js';
export { AuxToggle } from './widgets/aux-toggle.js';
export { AuxLabel } from './widgets/aux-label.js';
export { AuxIcon } from './widgets/aux-icon.js';
export { AuxGauge } from './widgets/aux-gauge.js';
export { AuxProgressBar } from './widgets/aux-progressbar.js';
export { AuxValue } from './widgets/aux-value.js';
export { AuxValueButton } from './widgets/aux-valuebutton.js';
export { AuxMeter } from './widgets/aux-meter.js';
export { AuxLevelMeter } from './widgets/aux-levelmeter.js';
export { AuxSelect } from './widgets/aux-select.js';
export type { SelectEntry } from './widgets/aux-select.js';
export { AuxComboBox } from './widgets/aux-combobox.js';
export { AuxContainer } from './widgets/aux-container.js';
export { AuxExpand } from './widgets/aux-expand.js';
export { AuxScrollArea } from './widgets/aux-scrollarea.js';
export { AuxPages } from './widgets/aux-pages.js';
export { AuxPager } from './widgets/aux-pager.js';
export { AuxChart } from './widgets/aux-chart.js';
export type { Graph } from './widgets/aux-chart.js';
export { AuxEqualizer } from './widgets/aux-equalizer.js';
export { AuxDynamics, AuxCompressor, AuxGate } from './widgets/aux-dynamics.js';
export type { DynamicsType } from './widgets/aux-dynamics.js';
export { AuxMatrix } from './widgets/aux-matrix.js';
export type { MatrixPort } from './widgets/aux-matrix.js';

// DSP helpers.
export { biquadCoeffs, magnitudeDb, bandResponseDb, combinedResponseDb } from './core/biquad.js';
export type { FilterBand, FilterType, BiquadCoeffs } from './core/biquad.js';

// Core utilities (useful when composing custom widgets).
export { Range, RANGE_DEFAULTS } from './core/range.js';
export type { RangeOptions, ScaleLaw } from './core/range.js';
export { WidgetBase } from './core/widget-base.js';
export { ValueWidget } from './core/value-widget.js';
export { attachDragValue, projectDelta } from './core/drag-value.js';
export { attachScrollValue } from './core/scroll-value.js';
export { describeArc, coefToAngle, polarToCartesian } from './core/svg.js';
