# my-circle

A minimal hand-written web component: a resizable, recolourable SVG circle.
It demonstrates the banira conventions the toolchain understands — attributes
via `observedAttributes`, a `CustomEvent`, and the `@slot` / `@csspart` /
`@cssprop` / `@fires` / `@demo` documentation tags in
[my-circle.ts](./my-circle.ts).

All commands below run from this directory (`examples/my-circle`).

## Compile

```bash
npx banira compile my-circle.ts -o demo/dist
```

## Run the demo

```bash
npx banira serve demo
```

Then open http://localhost:8080/ — the demo page loads the compiled component
from `demo/dist` and live-reloads on changes. For a full dev loop, run
`npx banira watch my-circle.ts -o demo/dist` in a second terminal.

## Generate documentation

```bash
# HTML doc page (summary, live @demo, API reference), next to the compiled output
npx banira doc my-circle.ts -o demo/doc.html

# Custom Elements Manifest
npx banira manifest my-circle.ts -o custom-elements.json
```

`demo/doc.html` references the component as `./dist/my-circle.js`, so it works
when served via `npx banira serve demo`.
