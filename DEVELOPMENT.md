# Development

[![CI](https://github.com/sebs/banira/actions/workflows/ci.yml/badge.svg)](https://github.com/sebs/banira/actions/workflows/ci.yml)
[![Release](https://github.com/sebs/banira/actions/workflows/release.yml/badge.svg)](https://github.com/sebs/banira/actions/workflows/release.yml)
[![GitHub release](https://img.shields.io/github/v/release/sebs/banira)](https://github.com/sebs/banira/releases/latest)
[![npm](https://img.shields.io/npm/v/banira)](https://www.npmjs.com/package/banira)

This software is a work in progress. Your best shot is to build it on a unix or
linux machine.

## Prerequisites

- Node.js `>=18.19.0`

## Setup

```bash
make bootstrap   # install dependencies and build
```

## Git hooks

A `pre-commit` hook runs `make lint` and `make test`. It lives in
[`.githooks/`](./.githooks) (plain shell, no dependency) and is wired up by the
`prepare` script on `npm install` via `git config core.hooksPath .githooks`.
Bypass it for a single commit with `git commit --no-verify`.

## Common tasks

| Command | Description |
|---|---|
| `make bootstrap` | Install dependencies and build |
| `make test` | Run the test suite |
| `make lint` | Type-check `src` and `test` with strict settings (emits nothing) |
| `make docs` | Generate the API documentation with TypeDoc |
| `make clean` | Remove build artifacts and dependencies |

The same steps are available as npm scripts (`npm run build`, `npm test`,
`npm run lint`, `npm run docs`).

Run a single test file:

```bash
node --import tsx --test ./test/manifest.test.ts
```

## Project layout

```
src/        library source; src/cli is the banira command
test/       test suite (test/fixtures holds component fixtures)
examples/   reference components (my-circle), excluded from the package
dist/       build output (the published package)
```

The CLI co-compiles the library into its own output (`src/cli` imports the
library by relative path), so a single `tsc` build produces both the library
entry (`dist/index.js`) and the `banira` binary (`dist/cli/index.js`) with no
bundler and no separate runtime dependency.

API convention: stateful multi-step workflows are classes (`Compiler`, `DocGen`,
`ManifestGenerator`, `TestHelper`); pure one-shot helpers are free functions
(`bundleModule`, `createVirtualCompilerHost`).

## Testing notes

- Component tests mount in JSDOM via `TestHelper` and wait deterministically for
  the element to be defined (`customElements.whenDefined`), bounded by
  `TestHelper.readyTimeout`.
- For higher-fidelity, real-browser tests, `TestHelper.mountInBrowser` uses
  Playwright as an **optional** peer dependency. Install it only if you need it:

  ```bash
  npm i -D playwright
  npx playwright install chromium
  ```

## Releasing

Versioning is single-package: bump the version and push the tag.

```bash
npm version patch   # bumps package.json and creates the matching vX.Y.Z tag
git push --follow-tags
```

Pushing a `v*` tag triggers the [release workflow](.github/workflows/release.yml),
which verifies the tag matches `package.json`, builds, runs `npm pack`, and
attaches the tarball to a GitHub release.
