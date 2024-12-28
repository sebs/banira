# @vanillin/component-webaudio

A collection of Web Components for creating audio control interfaces. Based on the webaudio-controls project but reimplemented in TypeScript with modern web standards.

## Components

- `webaudio-knob`: Rotary control for parameters
- `webaudio-slider`: Linear slider control
- `webaudio-switch`: Toggle or momentary switch
- `webaudio-param`: Parameter display

## Installation

```bash
npm install @vanillin/component-webaudio
```

## Usage

```html
<script type="module">
  import { WebAudioKnob, WebAudioSlider, WebAudioSwitch, WebAudioParam } 
    from '@vanillin/component-webaudio';
</script>

<webaudio-knob value="50" min="0" max="100"></webaudio-knob>
<webaudio-slider value="50" min="0" max="100"></webaudio-slider>
<webaudio-switch value="0"></webaudio-switch>
<webaudio-param value="50"></webaudio-param>
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test
```

## License

MIT
