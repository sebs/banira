# AUX widget port — per-widget specification

Clean-room API specification distilled from the GPLv3 `DeutscheSoft/aux-widgets`
source (option **names/types/defaults/events** only — functional API facts, no
implementation copied). This is the build target for `@banira/component-aux`.

Conventions in the original:
- Every widget applies a root class `aux-<name>` and renders into **light DOM**.
- The value↔pixel math lives in **Ranged/Range**; controls only supply `min/max/scale/basis/step/snap`.
- The user-driven setter path is `userset('value', v)` → emits `useraction`; option writes emit `set_<option>`.

Our port maps: `userset` → `input` CustomEvent, value commit → `change`; option
writes → property/attribute reflection. Shadow DOM instead of light DOM, themed
via CSS custom properties + `::part`.

---

## Foundation

### Range (scaling math) — *core module*
| option | type | default | meaning |
|---|---|---|---|
| scale | `'linear'\|'decibel'\|'log2'\|'frequency'\|'frequency-reverse'\|fn\|number[]` | `'linear'` | scale law (or custom fn / piecewise even-length array) |
| reverse | boolean | false | invert direction |
| basis | number | 1 | linear scale size (pixels span) |
| clip | boolean | true | clamp into [min,max] |
| min | number | 0 | range minimum |
| max | number | 1 | range maximum |
| base | number | 0 | anchor for grid alignment |
| step | number | 0 | interaction step |
| shift_up | number | 4 | speed × with Shift |
| shift_down | number | 0.25 | speed × with Shift+Ctrl |
| snap | number\|number[] | 0 | grid spacing or explicit snap points |
| log_factor | number | 1 | curvature for log/decibel |

Methods: `valueToCoef(v)→[0..1]`, `coefToValue(c)`, `valueToPixel(v)`, `pixelToValue(p)`, `snap(v)`, `clamp(v)`.

### DragValue — *core module* (pointer → value)
| option | type | default | meaning |
|---|---|---|---|
| direction | `'polar'\|'vertical'\|'horizontal'` | 'polar' | drag mode |
| rotation | number | 45 | polar: axis of positive change (0=up) |
| blind_angle | number | 20 | polar: dead-zone angle |
| basis | number | 300 | px travel spanning min→max |
| reverse | boolean | false | invert travel |
| limit | boolean | false | clamp to range |
Events: `startdrag`, `dragging`, `stopdrag`.

### ScrollValue — *core module* (wheel → value)
| option | type | default | meaning |
|---|---|---|---|
| scroll_direction | `[x,y,z]` | `[0,-1,0]` | per-axis wheel multipliers |
| limit | boolean | false | clamp to range |
Events: `scrollstarted`, `scrolling`, `scrollended`.

### Circular geometry — *core helper* (SVG arc)
Key options: `start` (deg, 135), `angle` (span deg, 270), `base` (false→min),
`thickness` (px), `margin`, `hand {width,length,margin}`, `dots[]`, `markers[]`, `labels[]`.
`value→coef×angle` = sweep, arc begins at `start`, spans `angle` clockwise.

---

## Base/Widget generic options (inherited by all)
| option | type | default |
|---|---|---|
| class | string | "" |
| disabled | boolean | false |
| active | boolean | true |
| visible | boolean | true |
| interacting | boolean | false |
| tabindex | number\|boolean | false |
| role | string | "none" |
| id / title | string | "" |

Lifecycle (our analogues): `initialize`→constructor, `draw`/`redraw`→`render()`,
`invalidate(key)`→`requestUpdate()`, `set/get`→property accessors,
`addChild/appendChild/setParent`→DOM/slots, `enableDraw/disableDraw`→rAF gating,
`destroy`→`disconnectedCallback`. Events: `set`, `set_<opt>`, `userset`, `useraction`.

---

## Controls

### Knob (`extends Widget`; composes Circular + DragValue + ScrollValue)
| option | type | default | meaning |
|---|---|---|---|
| value | number | 0 | current value |
| min / max | number | 0 / (range) | range |
| step | number | 1 | interaction step |
| basis | number | 300 | drag px span min→max |
| reset | number | =value | dbl-click reset |
| bind_dblclick | boolean | true | enable dbl-click reset |
| blind_angle | number | 20 | polar dead-zone |
| rotation | number | 45 | polar positive-change axis |
| direction | string | 'polar' | drag mode |
| shift_up / shift_down | number | 4 / 0.25 | fine/coarse multipliers |
| preset | string | 'medium' | size preset (tiny/small/medium/large/huge) |
| thickness | number | 6 | arc thickness |
| tabindex | number | 0 | focus order |
| role | string | 'slider' | ARIA role |
| set_ariavalue | boolean | true | write ARIA value attrs |
Events: `useraction`, `dblclick`, `startdrag`/`stopdrag`, `scrollstarted`/`scrollended`.

### Fader (`extends Widget`; Ranged + DragValue + ScrollValue)
| option | type | default | meaning |
|---|---|---|---|
| value | number | 0 | current value |
| layout | `'top'\|'left'\|'right'\|'bottom'` | 'left' | handle side (derives orientation) |
| levels | number[] | [1,6,12,24] | scale levels |
| gap_dots | number | 3 | scale dot gap |
| gap_labels | number | 40 | scale label gap |
| show_labels | boolean | true | show scale labels |
| labels | fn | `v=>v.toFixed(2)` | label format |
| reset | number | =value | dbl-click reset |
| bind_click | boolean | false | click-to-move |
| bind_dblclick | boolean | true | dbl-click reset |
| role | string | 'slider' | ARIA role |
Events: `useraction`, `set_layout`, `set_interacting`, `scalechanged`.

### Slider (`extends Widget`; Ranged + DragValue + ScrollValue)
| option | type | default | meaning |
|---|---|---|---|
| value | number | 0 | current value |
| alignment | `'horizontal'\|'vertical'` | 'horizontal' | orientation |
| basis | number | 300 | drag px span |
| direction/rotation/blind_angle | — | polar/45/20 | polar drag params |
| role | string | 'slider' | ARIA role |
Events: `useraction`, `set_value`, `dblclick`.

### ValueButton (`extends Button`; DragValue + ScrollValue + inner Value)
| option | type | default |
|---|---|---|
| value | number | 0 |
| direction/rotation/blind_angle | — | polar/45/20 |
| snap | number | 0.01 |
| basis | number | 300 |
| labels | fn | `%d` |
| layout | string | 'top' |
| reset | number | =value |
Events: `useraction`, `doubleclick`, `valueedit`, `valueset`.

---

## Buttons / text

### Button (`extends Widget`)
| option | type | default | meaning |
|---|---|---|---|
| label | string\|false | false | text (false=no label node) |
| icon | string\|false | false | icon class/var/url |
| state | boolean | false | active state → `.aux-active` |
| layout | `'horizontal'\|'vertical'` | 'horizontal' | label/icon arrangement |
| delay | int | 0 | ms before delayed press event (0=off) |
| role | string | 'button' | ARIA role |
| tabindex | int | 0 | tab order |
Events: `pressed`, `press_start`, `press_end`, `press_cancel`, `press_delayed`, `clicked`.

### Toggle (`extends Button`)
| option | type | default | meaning |
|---|---|---|---|
| toggle | boolean | true | toggle state on click |
| label_active | string\|false | false | label when state true |
| icon_active / icon_inactive | string\|false | false | icon per state |
Events: `toggled` (boolean) + Button events. ARIA `aria-pressed`.

### Label (`extends Widget`)
| option | type | default |
|---|---|---|
| label | string | '' |
| format | fn\|false | false |

### Icon (`extends Widget`)
| option | type | default |
|---|---|---|
| icon | string\|false | false |
| role | string | 'img' |
Render via class, `background-image: var(--name)`, or `url(...)`.

### Value (`extends Widget`; `<input>`)
| option | type | default | meaning |
|---|---|---|---|
| value | number\|string | 0 | stored/displayed |
| format | fn | identity | display format |
| set | fn\|false | parseFloat(NaN-guard) | parse input (false=readonly edit) |
| size | number | 3 | input size |
| editmode | `'onenter'\|'immediate'` | 'onenter' | when to commit |
| readonly | boolean | false | readonly |
| placeholder | string | '' | placeholder |
Events: `useraction`, `valueclicked`, `valueescape`, `valueset`, `valuetyping`, `valuedone`.

---

## Display

### Gauge (`extends Widget`; composes Circular)
`width/height/size` (100), `x/y` (0), `label {pos:90,margin:0,align:'inner',label:''}`. Event: `labeldrawn`. DOM: `div>svg>text.aux-label` + Circular.

### Meter (`extends Widget`; **Canvas**, child Scale)
| option | type | default | meaning |
|---|---|---|---|
| layout | `left/right/top/bottom` | 'left' | orientation |
| segment | number | 1 | px rounding → LED segments |
| value | number | 0 | current level |
| value_label | number | 0 | label value |
| base | number\|false | false | fill start (false→min) |
| min/max | number | 0/(range) | range |
| label | string\|false | false | title |
| format_value | fn | `%.2f` | label format |
| background/foreground | color/gradient | 'transparent' | colors |
| paint_mode | `'inverse'\|'value'` | 'inverse' | fg-as-mask vs direct |
| show_scale | boolean | true | show Scale |
| role | string | 'meter' | ARIA role |
Events: `set_value`, `set_base`, `scalechanged`.

### LevelMeter (`extends Meter`)
| option | type | default | meaning |
|---|---|---|---|
| falling | number | 0 | falloff rate (0=off) |
| falling_duration | int | 1000 | ms falloff |
| falling_init | number | 50 | initial delay |
| top / bottom | number\|false | false | peak/bottom hold (false=track) |
| hold_size | int | 1 | hold marker size (segments) |
| show_hold | boolean | false | show hold indicators |
| clipping | number | 0 | clip threshold |
| auto_clip | int\|false | false | clip timeout ms (-1=forever) |
| auto_hold | int\|false | false | hold reset ms (-1=never) |
| clip | boolean | false | current clip state |
Events: `resetvalue`, `resetclip`, `resettop`, `resetbottom`.

### ProgressBar (`extends Meter`)
`min` 0, `max` 100, `show_scale` false, `show_value` true, `format_value` `v=>v.toFixed(2)+'%'`, `layout` 'top', `role` 'progressbar'.

---

## Composite / selection

### Select (`extends Button`) + SelectEntry (`extends Button`)
Select: `entries[]`, `selected` (-1), `value`, `auto_size` (false), `show_list` (false),
`placeholder` (false), `typing_delay` (250), `role` 'select'.
SelectEntry: `label` '', `value` null, `role` 'option', `selected` false.
Events: `useraction`, `select(value,index,label,entry)`, `entryadded`, `entryremoved`, `cleared`.
Single-selection dropdown; typing does partial-label match; closes on select/Tab/Esc/outside.

### ComboBox (`extends Widget`; Select + Value)
`value` (null), forwards `entries`/`list_class`. Event: `select`. Editable text + dropdown kept in sync.

---

## Layout (deferred — large; see build plan)
- **Container** (`children[]`, `hiding_duration`, `showing_duration`, `render_while_hiding`).
- **Expand** (`expanded`, `always_expanded`, `group`, `label`, `icon`; events `expand/collapse/expanded/collapsed`; child Toggle).
- **ScrollArea** (IntersectionObserver-driven child visibility; native overflow).
- **Pager/Pages/Navigation/Dialog**.

## DSP/charting (deferred — largest)
- **Chart** (axes/graphs/grid, Canvas/SVG), **Equalizer** (band handles over a frequency response curve),
  **Dynamics/Gate/Compressor** (transfer-curve charts), **Matrix** (virtualized port/connection grid + MatrixData/GroupData/PortData).

---

## Build tiers — all complete ✅
1. **Foundation:** Range, DragValue, ScrollValue, SVG arc, WidgetBase, ValueWidget, biquad. ✅
2. **Tier-1 controls:** Label, Icon, Button, Toggle, Knob, Fader, Slider. ✅
3. **Tier-2 display/input:** Gauge, ProgressBar, Value, ValueButton, Icon. ✅
4. **Tier-3:** Meter, LevelMeter, Select, ComboBox. ✅
5. **Tier-4 layout:** Container, Expand, ScrollArea, Pages, Pager. ✅
6. **Tier-5 DSP/chart:** Chart, Equalizer, Dynamics/Compressor/Gate, Matrix. ✅

Known simplifications vs. the GPL original (behind stable APIs, swappable):
- Meters use a DOM fill instead of `<canvas>` (testable + themable).
- Matrix is not virtualised (no grouped ports / windowed scrolling yet).
- Scale laws implement linear / logarithmic / decibel; the AUX `frequency` and
  custom-array laws map onto logarithmic for now.
