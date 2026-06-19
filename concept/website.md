# banira.js — Website Concept

A concept for the banira project website, served from GitHub Pages at
`https://sebs.github.io/banira/`. Today Pages only hosts the generated TypeDoc
API reference; this document sketches the full site we grow around it.

## Goals

1. **Explain banira in 10 seconds.** A visitor should grasp "a toolchain for
   vanilla web components — no bundler, no framework" before scrolling.
2. **Get someone to a working component fast.** From landing page to
   `npx banira init` to a live demo in under a minute of reading.
3. **Be the canonical reference.** Host the CLI docs, the library API
   (TypeDoc), and the conceptual guides in one searchable place.
4. **Dogfood.** The site itself is built and documented with banira where it
   makes sense (e.g. a live `<my-button>` demo compiled by the CLI).

## Audience

- **Vanilla-JS / web-standards developers** tired of framework churn who want
  tooling, not a runtime.
- **LLM/agent builders** — banira's manifest + typed output is friendly to
  codegen (see the project's origin blog post).
- **Library authors** shipping web components who need a manifest, editor
  IntelliSense data, `.d.ts`, and a semver diff gate.

## Information architecture

```
/                     Landing — pitch, code sample, install, CTA
/docs/                Guides (hand-written, conceptual)
  getting-started       init → dev → test loop
  the-toolchain         how compile/manifest/doc/types fit together
  authoring-components  jsdoc tags banira reads (@slot, @csspart, @fires…)
  ci-and-release        manifest diff as a release gate, Pages, npm publish
/cli/                 One page per command (compile, doc, manifest, …)
/api/                 TypeDoc reference (already generated today)
/playground/          (later) in-browser compile + preview
```

The current Pages output (TypeDoc) slots in under `/api/`. Everything else is
new and additive, so we can ship incrementally.

## Landing page (above the fold)

- **Headline:** "A toolchain for vanilla web components."
- **Subhead:** "No bundler. No framework. Just web standards, TypeScript, and a
  CLI that compiles, documents, and type-checks your components."
- **Primary CTA:** `npx banira init my-button src` (copy-to-clipboard).
- **Secondary CTA:** "Read the docs" → `/docs/getting-started`.
- **Live proof:** a real banira-compiled `<my-button>` rendered on the page,
  with its source and generated doc page linked beside it.

### The one code block that sells it

```bash
npx banira init my-button src   # scaffold a component + demo
npx banira dev src/my-button.ts -o demo/dist -r demo   # watch + serve + live reload
```

Then a second block showing the payoff — one source file producing a manifest,
typed `.d.ts`, editor data, and an HTML doc page:

```bash
banira manifest  src/*.ts -o custom-elements.json
banira types     src/*.ts -o dist/elements.d.ts
banira doc       src/my-button.ts -o docs/my-button.html
```

## "Why banira" section

Three columns, each a concrete differentiator from the README:

| Standards, not abstractions | One source, many artifacts | Built for CI |
|---|---|---|
| Vanilla custom elements, shadow DOM, modern CSS. No runtime to ship. | A component yields a manifest, `.d.ts`, VS Code / JetBrains IntelliSense, and docs. | `banira test` smoke-mounts every element; `banira diff` suggests a semver bump. |

## Design language

- **Tone:** pragmatic, standards-forward, lightly opinionated. Honest about the
  "work in progress" status (mirror the README warning, don't hide it).
- **Styling:** lean on PicoCSS — banira's own `doc` command defaults to it, so
  the site and generated component docs share a visual language for free.
- **Theme:** light/dark via `prefers-color-scheme`. Minimal JS; the site should
  itself be a demonstration of "you don't need a framework."

## Build & deploy

- Static site generated in the Pages workflow alongside TypeDoc, published as a
  single artifact. Candidate generators: a tiny markdown→HTML step, or 11ty if
  the guides grow. Keep the dependency surface small.
- The `/api/` route stays exactly today's `npm run docs` output, mounted as a
  subpath so the existing [pages.yml](../.github/workflows/pages.yml) workflow
  evolves rather than gets replaced.
- Custom domain later (e.g. `banira.dev`) via a `CNAME` file — out of scope for
  now.

## Phased rollout

- **Phase 0 (done):** TypeDoc API reference on Pages.
- **Phase 1:** Landing page + Getting Started, sharing the Pages deploy. Link
  the existing API reference under `/api/`.
- **Phase 2:** Per-command CLI pages (generated from the README/`--help` to
  avoid drift) and the conceptual guides.
- **Phase 3:** Live `<my-button>` demo on the landing page, compiled by banira
  in the build.
- **Phase 4:** In-browser playground (compile + preview), if there's appetite.

## Open questions

- Hand-written guides vs. generating CLI pages from `banira <cmd> --help` to
  keep them in sync with the source of truth.
- Static-site generator choice — raw HTML/markdown vs. 11ty — driven by how
  much hand-written content Phase 2 actually needs.
- Whether the playground (Phase 4) is worth the complexity, or a set of
  embedded live demos covers the need.
