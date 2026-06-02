# @banira/component-aux

Clean-room vanilla **web components for audio UIs**, built with
[banira](../banira). The widget set and API mirror the
[AUX widget library](https://github.com/DeutscheSoft/aux-widgets) (knobs,
faders, meters, …), but the implementation is original and MIT-licensed — no
GPL source is used. See [SPEC.md](./SPEC.md) for the per-widget specification
this port is built against.

## Status

Built and tested:

| Element | Description |
|---|---|
| `<aux-knob>` | Rotary knob — drag (polar) / wheel / keyboard, ARIA slider |
| `<aux-fader>` | Linear fader (orientation from `layout`) |
| `<aux-slider>` | Linear slider (orientation from `alignment`) |
| `<aux-valuebutton>` | Value display + drag/wheel/keyboard + inline edit |
| `<aux-value>` | Editable numeric/text field |
| `<aux-button>` | Button with label/icon |
| `<aux-toggle>` | Toggle button (`aria-pressed`, active label/icon) |
| `<aux-label>` | Text label |
| `<aux-icon>` | Icon (class / CSS var / url) |
| `<aux-gauge>` | Read-only circular gauge |
| `<aux-progressbar>` | Progress bar with value readout |
| `<aux-meter>` | Level bar (base→value) |
| `<aux-levelmeter>` | Meter with peak-hold, clip, falloff |
| `<aux-select>` | Single-selection dropdown (keyboard + type-ahead) |
| `<aux-combobox>` | Editable field with filtered suggestions |
| `<aux-container>` | Show/hide box (slotted children) |
| `<aux-expand>` | Collapsible section with header |
| `<aux-scrollarea>` | Native overflow scroller |
| `<aux-pages>` / `<aux-pager>` | Multi-page container / tabbed pager |
| `<aux-chart>` | 2D SVG chart (grid + polyline graphs) |
| `<aux-equalizer>` | Parametric EQ — biquad response + draggable bands |
| `<aux-dynamics>` / `<aux-compressor>` / `<aux-gate>` | Dynamics transfer curve |
| `<aux-matrix>` | Routing matrix (source × sink connection grid) |

Plus reusable cores: `Range` (scaling math), `DragValue`, `ScrollValue`, SVG arc
helpers, `biquad` DSP math, and `WidgetBase`/`ValueWidget`/`AuxChart` bases.

All AUX widget families are now represented. Known simplifications vs. the AUX
original: meters use a DOM fill rather than `<canvas>`; the matrix is not yet
virtualised (no grouped ports / windowed scrolling). Both are behind stable APIs
and can be swapped without breaking callers.

## Usage

```html
<script type="module">
  // Importing the package registers every aux-* element.
  import '@banira/component-aux';
</script>

<aux-knob value="64" min="0" max="127" size="120"></aux-knob>
<aux-fader value="0" min="-60" max="6" step="0.5" layout="left"></aux-fader>
```

Or import individual widgets / cores:

```js
import { AuxKnob, Range } from '@banira/component-aux';
```

### Theming

Widgets render into shadow DOM and expose CSS custom properties:
`--aux-accent`, `--aux-track`, `--aux-hand`, `--aux-fg`, `--aux-button-bg`,
`--aux-knob-size`, `--aux-fader-width/height`, … plus `::part()` hooks
(`track`, `value`, `handle`, `hand`, `label`, `icon`).

### Events

Value widgets emit DOM-idiomatic events: `input` while interacting and `change`
on commit, with `detail: { value }`. Buttons emit `clicked`/`pressed`; toggles
emit `toggled` with `detail: { state }`.

## Development

```bash
npm run build     # tsc → dist/
npm test          # node --test (JSDOM)
npm run showcase  # build + serve the combined demo at showcase/index.html
npm run demo      # banira doc → ./demo/index.html (single-widget doc page)
```

The **showcase** (`showcase/index.html`) is a single bundler-free page that loads
`../dist/index.js` as an ES module and exercises every widget — live meters, a
draggable equalizer, a routing matrix, tabbed pages, and event readouts.

## License

MIT
