# banira — Full Review

**Repository:** `sebs/banira` · **Branch:** `claude/nice-babbage-r9RSF` (even with `main`)
**Date:** 2026-06-01
**Scope:** whole codebase — correctness, code quality, developer experience (DevX), and user experience (UX).
**Packages:** `banira` (core lib), `banira-cli`, `component-my-circle` & `component-webaudio` (examples).

---

## 1. Executive summary

`banira` is a bundler-free toolchain for vanilla-JS web components: a TypeScript compiler wrapper with a `.js`-import transformer, a virtual-FS compiler host, a JSDOM-based test helper, and a TSDoc-driven doc generator. It is a clean, focused, well-documented project for an early-stage tool, with excellent TSDoc coverage and a sensible test layout.

Three themes hold it back today:

1. **Half-implemented doc generation.** The doc generator parses TSDoc, then renders a static HTML shell that ignores everything it parsed — the headline feature produces a near-empty page.
2. **Diverging sources of truth.** Compiler options, module/target settings, the `.js`-extension convention, and component naming are each defined in more than one place and disagree.
3. **Heavy, link-dependent workflow.** Every commit reinstalls the whole monorepo; onboarding depends on a global `npm link`; and one example's documented API doesn't exist.

None are catastrophic for a "work in progress," but #1 and the transformer gap (3.2) undercut the project's stated purpose, and the DevX issues slow every contribution.

### Severity tally

| Severity | Count | Items |
|---|---|---|
| 🔴 High | 6 | 3.1, 3.2, 3.3, 5.1, 6.1, 6.2 |
| 🟠 Medium | 11 | 4.1–4.6, 5.2–5.5, 6.3 |
| 🟡 Low | 12 | see §7 and §8 |

---

## 2. Architecture overview

```
banira (core)
  compiler.ts          Compiler wrapper around tsc; DEFAULT_COMPILER_OPTIONS; withVirtualFs()
  virtual-fs.ts        memfs-backed CompilerHost
  transformer.ts       appends ".js" to relative import specifiers
  result-analyzer.ts   categorizes diagnostics; exposes comments/sourceFiles/outputFiles
  discover-comments.ts walks AST collecting JSDoc comment ranges
  doc-gen.ts           TSDoc parse + custom @demo tag
  formatter/doc-page.ts renders the HTML doc page
  test-helper.ts       compile + mount component in JSDOM

banira-cli              commander CLI -> actions/compile.ts, actions/doc.ts (consume banira)
component-my-circle     example: <my-circle> + hand-written demo
component-webaudio      example: <wa-knob> + banira-generated demo
```

**Strengths worth preserving:** thorough example-rich TSDoc on the core library; a clean, well-tested virtual-FS host; good module separation (compile / analyze / discover / format); dependency-light testing via Node's built-in runner + `tsx`; a sensible CI Node matrix (18/20/22) and a husky gate.

---

## 3. Correctness — High

### 3.1 Doc generation parses TSDoc but renders none of it
`src/formatter/doc-page.ts:26-55` — `createDocPage()` produces a fixed HTML shell using only `tagName`, `src`, `title`. The getters `custom`, `logs`, `params`, `summary` (lines 10-24) are **never used**, and parsed `@demo`/summary content never reaches the output. `DocGen.renderDocs()` (`doc-gen.ts:87-93`) therefore parses, validates `docComment`, then discards it. The doc comment claims *"Renders only the custom documentation blocks … like @demo"* (`doc-gen.ts:80-82`); the implementation does not.
**Fix:** emit `summary`, `params`, and `@demo` blocks in `createDocPage`, or downgrade the docs to "scaffolds a preview page."

### 3.2 The `.js` import transformer misses re-exports and dynamic imports
`src/transformer.ts:37-52` only rewrites `ts.isImportDeclaration`. It does **not** handle `export { x } from './y'`, `export * from './y'` (`ExportDeclaration`), or dynamic `import('./y')`. For a browser-ESM toolchain whose entire reason to exist is extensionless specifiers breaking in the browser, re-exports are a common, silently-broken case. (`src/index.ts` hand-writes `.js`, masking the gap.)
**Fix:** also visit `ExportDeclaration` and dynamic-import `CallExpression`s.

### 3.3 CLI `compile` ignores the library's default compiler options
`banira-cli/src/actions/compile.ts:9,37` — without `--project`, `compilerOptions` stays `{}`, so `new Compiler(files, {})` runs with no `module`/`target`/`outDir`/`lib` and falls back to bare `tsc` defaults rather than `Compiler.DEFAULT_COMPILER_OPTIONS`. Output target/module and emission location become unspecified.
**Fix:** default to `Compiler.DEFAULT_COMPILER_OPTIONS` merged with CLI overrides.

---

## 4. Correctness & quality — Medium

### 4.1 `noEmitOnError: false` + ignored diagnostics
`compiler.ts:110` keeps emitting on error, and `test-helper.compileAndMountAsScript` (`test-helper.ts:86-94`) never checks diagnostics — a broken component mounts silently as malformed JS.

### 4.2 `getDefaultLibFileName` returns a file not in the virtual FS
`virtual-fs.ts:90` returns `lib.es6.d.ts`, but `loadTypeScriptLibFiles` (`compiler.ts:18-22`) only loads `lib.es2015/dom/es5`. Works today only because `DEFAULT_COMPILER_OPTIONS.lib` is set explicitly and bypasses the default; a caller omitting `lib` hits a missing-file path.

### 4.3 Unnecessary `as any` over a public field
`test-helper.ts:88-89` casts `compiler as any` (with an eslint-disable) to read `host`, but `Compiler.host` is already `public readonly` (`compiler.ts:97`). Use `compiler.host` and drop the cast + disable.

### 4.4 Timing-based test synchronization
`test-helper.ts:137` waits a hard-coded `setTimeout(…,100)` for component upgrade — flaky on slow CI. Prefer `customElements.whenDefined(tagName)` / poll for upgrade.

### 4.5 `make docs` depends on an undeclared tool
The `docs` Makefile target runs `npx typedoc`, but `typedoc` is not a dependency anywhere — non-reproducible (fetches latest at run time). Add it to root `devDependencies`.

### 4.6 CI does redundant install/clean churn
`.github/workflows/ci.yml` runs `npm install` → `make clean` (deletes `packages/*/node_modules`) → `make bootstrap` (reinstalls), fighting `cache: 'npm'`. The final `npx eslint …` step also duplicates the `make lint` target.

---

## 5. Developer Experience (DevX)

### 5.1 🔴 Pre-commit hook reinstalls the entire monorepo on every commit
`.husky/pre-commit`: `npm run lint` → `make clean` (wipes every `node_modules` + `dist`) → `make bootstrap` (reinstall all workspaces + build + global `npm link`) → `make test`. Minutes of work — and a network round-trip — to commit a one-line change; fails offline. The single biggest DevX problem.
**Fix:** pre-commit should be fast/incremental (lint + test, ideally lint-staged) against the installed tree; reserve clean/bootstrap for CI or a `make reset`.

### 5.2 🟠 Onboarding depends on global `npm link` + Makefile-only flow
`Makefile bootstrap` does `cd packages/banira-cli && … npm link`. Global linking can need elevated permissions and breaks if the npm prefix isn't writable; `component-webaudio`'s `build:banira`/`demo` scripts then call the global `banira`, so the examples only work if the link succeeded — undocumented. Everything routes through `make`, which the README admits is unix/linux-only (no Windows path).
**Fix:** use the existing `file:../banira` workspace dep via `npx banira`; document assumptions.

### 5.3 🟠 No reproducible install; no `engines`
Committed `package-lock.json` but README/Makefile/CI use `npm install`, not `npm ci`. No `engines` field, yet CI targets Node 18/20/22 and the code uses `import.meta.resolve` (`compiler.ts:15`), stable only on newer Node — a Node 18 contributor gets no upfront signal. Add `engines` and switch to `npm ci`.

### 5.4 🟠 `postinstall: npm run build` on the published library
`banira/package.json` runs `tsc` on `postinstall`, so a consumer's `npm install banira` compiles TS inside `node_modules` — slow, surprising, fragile. Ship prebuilt `dist/`; use `prepare`/`prepublishOnly`.

### 5.5 🟠 Inconsistent, partly-incorrect test scripts
`banira`/`banira-cli`: `--test ./test/*test.ts`; `component-webaudio`: `--test ./test/*` (globs **all** files, will execute fixtures as the suite grows); `component-my-circle`: a single hardcoded file. Standardize on one pattern (e.g. `./test/**/*.test.ts`).

### 5.6 🟡 Inner-loop friction
No watch/dev script; duplicated version string `program.version('0.1.0')` (`banira-cli/src/index.ts:12`) hand-synced with `package.json`; no `CONTRIBUTING.md` for the multi-package link/Make workflow.

---

## 6. User Experience (UX)

### 6.1 🔴 `component-webaudio` README documents an API that doesn't exist
README shows `import { WebAudioKnob, WebAudioSlider, WebAudioSwitch, WebAudioParam } from '@banira/component-webaudio'` and `<webaudio-knob>` etc. Reality (`src/wa-knob.ts`): the only component is `WAKnob`, registered as **`wa-knob`**; the class is **not exported** (file just calls `customElements.define`); and `package.json` points `main`/`types` at `dist/index.{js,d.ts}` though **no `src/index.ts` exists** — so the documented import resolves to nothing and fails. Three names for one thing: `WAKnob` / `wa-knob` / `webaudio-knob`.
**Fix:** add a real `src/index.ts` barrel export; reconcile element/class/doc names; document the actual `wa-knob` API (mark the rest "planned").

### 6.2 🔴 The audio knob isn't interactive or accessible
`wa-knob.ts render()` maps value→rotation but there is **no pointer, wheel, or keyboard handling** — the knob can't be turned. No `tabindex`, no `role="slider"`, no `aria-valuenow/min/max/label`. `my-circle` likewise emits bare `<svg>` with no `role`/`aria-label` (acceptable if decorative; add `aria-hidden`).
**Fix:** add drag/wheel/arrow-key interaction, focusability, and ARIA slider semantics to the flagship example.

### 6.3 🟠 The generated doc page is nearly empty
Because of 3.1, `banira doc wa-knob.ts` yields a title + `<wa-knob></wa-knob>` and nothing else — no description, no `@demo`, no controls — versus the hand-written `component-my-circle/demo/index.html` with wired-up sliders/color pickers (the UX users expect, discarded by the generator). The page title is the raw filename (`wa-knob Component Demo`).

### 6.4 🟠 CLI output/ergonomics inconsistent and raw
- **Asymmetric I/O:** `compile` has `-o/--outDir`, but `doc` only writes stdout (users must shell-redirect). Add `-o/--output` to `doc`.
- **Raw error dumps:** `compile.ts:26` logs an array of diagnostic objects; `doc.ts:13` logs the raw `error` — ironic when `ResultAnalyzer.diag().formatted` already produces clean, colorized output the CLI ignores.
- **No `--help` examples; no `--quiet`/`--json`** for scripting.

---

## 7. Inconsistencies (consolidated)

| # | Inconsistency | Where |
|---|---|---|
| 1 | Root README says doc gen is based on `@example`; code uses `@demo` | `README` vs `doc-gen.ts:28-31` (fixture mixes both: `fixtures/my-circle.ts:4,79`) |
| 2 | Two diverging compiler-option sources | `Compiler.DEFAULT_COMPILER_OPTIONS` ES2015/ES2015/NodeJs (`compiler.ts:102-116`) vs `banira/tsconfig.json` ES2020/ESNext/node |
| 3 | `.js`-extension convention applied inconsistently | most imports `.js`; `result-analyzer.ts:12` omits it (also a stray double space) — in the project whose transformer adds `.js` |
| 4 | Doc comment vs behavior | `doc-gen.ts:80-82` / `formatter/doc-page.ts:26` |
| 5 | Lib files loaded vs default lib name | `compiler.ts:18-22` vs `virtual-fs.ts:90` |
| 6 | Component naming: class / element / docs disagree | `WAKnob` vs `wa-knob` vs README `webaudio-knob`/`WebAudioKnob` |
| 7 | Package naming scheme | unscoped `banira`/`banira-cli` vs scoped `@banira/component-*`; lib pkg and CLI `bin` both named `banira` |
| 8 | Module/config style | repo is ESM, but `eslint.config.js` is CommonJS and hand-maintains a `globals` list |
| 9 | `banira-cli` consumes banira two ways | imports built `banira` (`actions/*.ts:1`) **and** `tsconfig.json` includes `../banira/src` (`rootDir: ../../` → deeply nested `dist/packages/banira-cli/src/index.js` bin) |
| 10 | Lint invoked three ways | `make lint` vs CI `npx eslint` vs husky `npm run lint` |
| 11 | Duplicate parse methods | `DocGen.fromString` vs private `parseString` (`doc-gen.ts:52-77`) |
| 12 | Version string duplicated | `banira-cli/src/index.ts:12` vs `package.json` |

---

## 8. Low-severity nits

- `result-analyzer.ts:12` — `import  { CompilerResult } from './compiler';` double space + missing `.js`.
- `doc-gen.ts:43` — `DocGen` defaults `tagName = "my-circle"`; demo value leaking as a library default.
- `transformer.ts:67-75` — `@example` shows `import { Compiler } from 'typescript'; new Compiler({transformers…})`, not a real API and not this `Compiler`.
- `test-helper.ts:93` — `basename(fileName).replace('.ts','.js')` replaces first occurrence anywhere; anchor with `/\.ts$/`.
- `compile.ts:47` — `diagnostic.start!` can throw on position-less diagnostics; guard it.
- `actions/compile.ts` / `doc.ts` — declared `async` with no `await`.
- `IFoundComment` / `discoverComments` not re-exported from `index.ts`, so `ResultAnalyzer.comments`' return type can't be named by consumers.
- `cli.test.ts:18-27` — compiles to the real filesystem (no cleanup); `exitCode` assertion commented out (line 25).
- `component-my-circle/README.md` is an empty stub yet linked from the root README.
- `component-webaudio/README.md` "Components" lists four controls; only one partially exists.

---

## 9. Recommended sequencing

**Quick wins (high value / low effort)**
1. Slim the pre-commit hook to lint + test (5.1) — recovers the inner loop immediately.
2. Add `src/index.ts` to `component-webaudio` and fix README names (6.1) so the example imports/runs.
3. Add `-o/--output` to `banira doc` and route CLI errors through `ResultAnalyzer.diag().formatted` (6.4).
4. Add `engines` + switch CI/docs to `npm ci` (5.3); add `typedoc` to devDependencies (4.5).
5. Fix `result-analyzer.ts` import + drop the `as any` in `test-helper.ts` (3 in §7, 4.3).

**Core features**
6. Render real content (summary + `@demo`) in `createDocPage` (3.1).
7. Extend the transformer to re-exports + dynamic imports (3.2).
8. CLI falls back to `DEFAULT_COMPILER_OPTIONS` and checks diagnostics before mounting (3.3, 4.1).
9. Unify the compiler-option / module-target / naming sources of truth (§7 items 2, 6, 7).

**Follow-up**
10. Make `wa-knob` interactive + accessible (6.2) — it's the showcase component and currently doesn't turn.
