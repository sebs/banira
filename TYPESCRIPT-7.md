# TypeScript 7 and banira

Status of a TypeScript 7 migration for banira, and what a port of the engine
would actually require.

Researched 2026-09-21 against `typescript@7.0.2` (installed and inspected
directly), `@typescript/typescript6@6.0.2`, and the current banira `main`
(0.6.0, on `typescript@6.0.3`).

## Summary

banira cannot move its engine to TypeScript 7.0. This is not a porting effort
that was tried and found hard — **TypeScript 7.0 ships no programmatic compiler
API at all**. The `typescript` package's root export is now two values:

```js
import * as ts from 'typescript';
// => { version: '7.0.2', versionMajorMinor: '7.0' }
```

From the [7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/):

> While TypeScript 7.0 is here, it does not ship with an API.

and, on why Vue/Astro/Svelte/Angular tooling is also stuck:

> TypeScript 7 does not yet expose a stable programmatic API

banira is not an unusual case here. Angular, Vue, Svelte, typescript-eslint,
ts-morph, ts-jest and webpack loaders are all blocked on the same thing.

**The assumption that 7 is a strict superset of 6 does not hold for the API.**
For the *language and the `tsc` CLI*, 7 is better and faster. For *embedding the
compiler*, 7.0 is a large regression — deliberately, and temporarily.

### What this means in practice

| Concern | Verdict |
|---|---|
| banira's engine (`createProgram`, transformers, emit) on TS 7.0 | Impossible today |
| banira staying on the full TS 6 API | Supported and officially blessed, via `@typescript/typescript6` |
| Using `tsc` 7 to build/type-check banira itself | Works today, verified, ~5x faster |
| banira's engine on TS 7.1 | Plausible but unconfirmed — see [TypeScript 7.1](#typescript-71) |

## The gap, measured

banira imports **72 distinct symbols** from `typescript` across 18 source files.
Checked against the complete TypeScript 7.0.2 surface (831 runtime exports plus
type-only declarations across every `typescript/unstable/*` subpath — 1423
symbols in total), **22 are absent**:

```
CompilerHost                          createProgram
CustomTransformers                    transpileModule
EmitResult                            getPreEmitDiagnostics
NodeFactory                           parseConfigFileTextToJson
Transformer                           convertCompilerOptionsFromJson
TransformerFactory                    flattenDiagnosticMessageText
TransformationContext                 formatDiagnosticsWithColorAndContext
TypeChecker                           displayPartsToString
factory                               getCombinedModifierFlags
sys                                   getLineAndCharacterOfPosition
                                      isStringLiteralLike
```

These fall into three very different categories, and conflating them is what
makes the situation look more recoverable than it is.

### 1. Cosmetic — renamed or relocated, portable today

TypeScript 7 *does* have a real AST story. `typescript/unstable/ast` exports 409
symbols including `SyntaxKind`, `ScriptTarget`, `NodeFlags`, the whole `isX`
predicate family, the scanner and JSDoc helpers.
`typescript/unstable/ast/factory` exports 370 `createX` node constructors (the
old `ts.factory` object, unbundled into free functions).
`typescript/unstable/ast/visitor` has `visitNode`, `visitNodes` and
`visitEachChild`. `forEachChild` and `getLineAndCharacterOfPosition` exist as
methods on the new remote-node types.

Diagnostic formatting helpers (`flattenDiagnosticMessageText`,
`formatDiagnosticsWithColorAndContext`) have no equivalent, but they are thin
string formatting over a `Diagnostic` and are straightforward to reimplement.

### 2. Structural — a different model, portable with real work

`createProgram(rootNames, options, host)` has no direct equivalent. TypeScript 7
replaces it with an out-of-process model: a Go server that the JS side drives
over RPC.

```js
import { API } from 'typescript/unstable/sync';
const api = new API({ /* ... */ });
const project = api.updateSnapshot().getProject('/tsconfig.json');
project.program;   // diagnostics
project.checker;   // type checker
```

Two consequences for banira:

- A `Project` is identified by a **`configFileName`** — a real `tsconfig.json`.
  banira currently constructs `CompilerOptions` objects in code and never
  requires a config file on disk.
- `typescript/unstable/fs` provides `createVirtualFileSystem(files)` and a
  `FileSystem` interface (`readFile`, `fileExists`, `directoryExists`,
  `getAccessibleEntries`, `realpath`, `writeFile`). This is a genuine
  replacement for `src/virtual-fs.ts`'s `CompilerHost` — arguably a cleaner one,
  since it is a small, well-defined interface rather than the sprawling
  `CompilerHost`.

`TypeChecker` becomes the `Checker` class, with a similar but RPC-shaped
surface.

### 3. Blocking — no equivalent exists at any price

This is the part that stops the port dead.

**There is no emit.** The `Program` class in
`typescript/unstable/sync` has these methods, and nothing else:

```
getCompilerOptions          getSyntacticDiagnostics    getDeclarationDiagnostics
getSourceFile               getBindDiagnostics         getProgramDiagnostics
getSourceFileNames          getSemanticDiagnostics     getGlobalDiagnostics
getSourceFileMetadata       getSuggestionDiagnostics   getConfigFileParsingDiagnostics
isSourceFileFromExternalLibrary
isSourceFileDefaultLibrary
```

No `emit()`. The only emit-adjacent API is `Emitter`, whose entire surface is:

```ts
export declare class Emitter {
    printNode(node: Node, options?: PrintNodeOptions): string;
}
```

That prints one node. It does not compile a program to JavaScript.

**There are no custom transformers.** `CustomTransformers`, `TransformerFactory`,
`Transformer` and `TransformationContext` are absent, and the string
`transformer` does not appear anywhere in the TypeScript 7.0.2 type
declarations. There is no hook to run an AST transform during emit.

**There is no `transpileModule`.** No in-memory single-file transpile.

banira's entire compile pipeline is built on exactly these three things.

## Per-module impact

Generated by checking each module's `typescript` imports against the TS 7.0.2
surface:

| Module | Blocking symbols |
|---|---|
| `src/compiler.ts` | `createProgram`, `CompilerHost`, `CustomTransformers`, `EmitResult`, `getPreEmitDiagnostics` |
| `src/manifest.ts` | `createProgram`, `TypeChecker`, `displayPartsToString`, `getCombinedModifierFlags`, `isStringLiteralLike` |
| `src/cli/actions/compile.ts` | `parseConfigFileTextToJson`, `convertCompilerOptionsFromJson`, `flattenDiagnosticMessageText`, `getLineAndCharacterOfPosition` |
| `src/result-analyzer.ts` | `EmitResult`, `getPreEmitDiagnostics`, `formatDiagnosticsWithColorAndContext`, `sys` |
| `src/transformer.ts` | `factory`, `TransformerFactory`, `Transformer`, `TransformationContext` |
| `src/css-transformer.ts` | `NodeFactory`, `TransformerFactory`, `flattenDiagnosticMessageText` |
| `src/mcp/tools/verify.ts` | `parseConfigFileTextToJson`, `convertCompilerOptionsFromJson`, `flattenDiagnosticMessageText` |
| `src/mcp/diagnostics.ts` | `flattenDiagnosticMessageText`, `getLineAndCharacterOfPosition` |
| `src/virtual-fs.ts` | `createProgram`, `CompilerHost` |
| `src/module-bundler.ts` | `createProgram` |
| `src/transpile-module.ts` | `transpileModule` |

Portable to TS 7.0 as-is (type-only or AST-only usage): `discover-comments.ts`,
`eleventy.ts`, `import-map.ts`, `lint.ts`, `prerender.ts`, `smoke-test.ts`,
`test-helper.ts`.

So roughly **the manifest/doc half of banira is portable; the compile half is
not**. `transformer.ts` and `css-transformer.ts` — the custom emit transformers
that rewrite import specifiers and inline CSS — have no path forward at all
until an emit-with-transformers API exists.

## The supported option: `@typescript/typescript6`

Microsoft's answer for tools in exactly this position is a compatibility package
that re-exports the TypeScript 6.0 API, installed under an npm alias so that
`import ... from 'typescript'` keeps working while `tsc` is version 7:

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

The compat package ships its binary as `tsc6` specifically so it can coexist
with 7's `tsc`.

This matters for banira's planning: **the full compiler API is not a dead
artifact frozen at `typescript@6.0.3`.** It has an ongoing, officially published
home. Note the compat package is currently at 6.0.2, one patch behind the
`typescript@6.0.3` banira pins today.

The announcement gives no EOL date or support window for the 6.0 API. That is
worth watching but is not an immediate risk.

## TypeScript 7.1

The [7.1 iteration plan](https://github.com/microsoft/TypeScript/issues/63703)
lists "Stabilize API" as its first Language and Compiler item, with three
sub-items:

- Content Mapper API
- **Emit API** (microsoft/typescript-go#4699)
- Language Service API

Plan dates from that issue:

| Date | Milestone |
|---|---|
| 2026-10-06 | 7.1 Beta |
| 2026-11-10 | 7.1 RC |
| 2026-11-24 | 7.1 Stable |

**Open question, not yet answered:** whether 7.1's Emit API exposes custom
transformer hooks. Custom transformers are *not* mentioned anywhere in the 7.1
iteration plan — only "Emit API". Secondary sources assert that transformer
support lands in 7.1, but the primary sources do not confirm it. Resolving this
requires reading microsoft/typescript-go#4699 directly, and it is the single
most important unknown for banira's roadmap: an Emit API that compiles a program
to JS but offers no transform hook would still leave `transformer.ts` and
`css-transformer.ts` stranded.

These are plan dates in an open planning issue, not shipped facts.

## What does work today: `tsc` 7 as banira's build compiler

Independent of the engine question, TypeScript 7's `tsc` can build banira right
now. Verified against this repo:

- `tsc7 -p tsconfig.lint.json` (type-checks `src` + `test`): **zero errors**.
- `tsc7` full build: emit is byte-identical to the TS 6 output except for
  `dist/cem-schema.d.ts`, where TS 7 preserves the source's single-quoted string
  literals instead of normalizing to double quotes. Semantically identical.
- Speed: **1.13s → 0.22s** for a full `src` + `test` type-check (~5x).

Costs: a second compiler in dev installs (~30MB for the platform binary), and
the quote-style churn in published `.d.ts` files.

This does not affect banira's *output*: the `.d.ts` files banira generates for
users come from `toTypeDefinitions`, which is string templating over the
manifest, not `tsc` declaration emit. The double-quoted tag names asserted in
`test/cli.test.ts` are unaffected by the build compiler choice.

## Recommendation

1. **Keep the engine on the TypeScript 6 API.** There is no alternative, and it
   is the officially supported position. Consider moving the dependency to
   `@typescript/typescript6` under an alias when a concrete reason appears —
   there is no benefit while `typescript@6.0.3` resolves correctly and is a patch
   ahead.
2. **Resolve the transformer question** by reading typescript-go#4699 before
   planning any port work. Everything downstream depends on the answer.
3. **Re-evaluate after 7.1 stable (planned 2026-11-24).** A port is a rewrite of
   `compiler.ts`, `virtual-fs.ts`, `transformer.ts`, `css-transformer.ts`,
   `transpile-module.ts`, `module-bundler.ts` and `result-analyzer.ts` against a
   different execution model (out-of-process, config-file-oriented). It is not
   worth starting against an unstable API with no emit.
4. **Adopting `tsc` 7 for build/lint is optional and reversible.** It buys ~1s
   and proves the source stays TS 7-clean. It also means banira would be built
   by a different compiler than the one it embeds, which is a mild smell for a
   compiler toolchain.

## Sources

- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [TypeScript 7.1 Iteration Plan (#63703)](https://github.com/microsoft/TypeScript/issues/63703)
- [microsoft/typescript-go#4699 — Emit API](https://github.com/microsoft/typescript-go/pull/4699) (not yet read)
- Direct inspection of `typescript@7.0.2` and `@typescript/typescript6@6.0.2` from npm
