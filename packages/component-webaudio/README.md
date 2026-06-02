# @banira/component-webaudio

A collection of Web Components for creating audio control interfaces. Based on the webaudio-controls project but reimplemented in TypeScript with modern web standards.

## Components

- `wa-knob` (`WAKnob`): Rotary control for parameters — **available**

Planned (not yet implemented):

- `wa-slider`: Linear slider control
- `wa-switch`: Toggle or momentary switch
- `wa-param`: Parameter display

## Installation

```bash
npm install @banira/component-webaudio
```

## Usage

```html
<script type="module">
  // Importing the package registers the <wa-knob> custom element.
  import '@banira/component-webaudio';
</script>

<wa-knob value="50" min="0" max="127"></wa-knob>
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
