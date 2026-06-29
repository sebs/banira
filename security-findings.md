# banira security findings

**Review date:** 2026-06-29
**Primary focus:** the MCP server (`src/mcp/`), added in commit `86cde3d` (`feat(mcp): add the banira mcp Model Context Protocol server`) — the newest and least-reviewed feature. A lighter pass was planned over the other toolchain features.

> **Scope note / methodology.** This review was run as a multi-agent fan-out (one finder per attack surface, each finding adversarially verified). The agent run **stalled ~1 minute into the analysis phase**, before the dedicated "other features" finders finished and before the automated verify/synthesis phases ran. The findings below were therefore consolidated by hand from (a) a full manual read of every `src/mcp/` file, (b) the finders' partial conclusions, and (c) **direct empirical confirmation** of the highest-impact items (SSRF, the HTML-injection lines). The MCP surface is covered thoroughly; the **non-MCP feature pass is incomplete** (see #17). Prior in-code references to `security-findings #N` point to an earlier review whose file is no longer in the tree — this is a fresh document and renumbers from 1.

## Threat model

The MCP server is launched locally (`banira mcp`) and connected to an LLM agent over stdio newline-delimited JSON-RPC 2.0. Attacker positions considered:

- **(a)** a confused or compromised agent issuing arbitrary tool calls/arguments;
- **(b)** **prompt injection** delivered through untrusted component file content (JSDoc `@summary`/`@demo`/descriptions) that the introspection tools surface back into the agent's context;
- **(c)** untrusted files/directories the agent is pointed at (a malicious repo or component).

The server itself advertises two security boundaries, so breaking either is a real finding: **`--read-only`** (no writes/scaffold/compile) and **`--local-only`** ("Restrict file access to the project/cwd and disable network-reaching output"). Stdout is also contractually reserved for JSON-RPC frames. Note that default mode intentionally reads/writes arbitrary paths and `test_component` intentionally runs component code — those are flagged only where a boundary flag fails to contain them.

## Severity summary

| Severity | Count | Findings |
| --- | --- | --- |
| High | 3 | #1, #2, #3 |
| Medium | 9 | #4–#12 |
| Low | 4 | #13–#16 |
| Info / accepted | 3 | #17, #18, #19 |
| **Total** | **19** | |

✅ **Confirmed correct (not findings):** `--read-only` does correctly omit every mutating tool (`scaffold_component`, `compile_component`); `resolveInputFiles` confines explicit `files`/`dir` under `--local-only`; `generate_docs` correctly escapes `scriptSrc`, page title, component summaries/descriptions, and all API-table cells; `generate_docs`/`stylesheetPath`/`href` reads are confined under `--local-only`; `findModuleFiles` does **not** descend into symlinked directories (no symlink-loop recursion).

---

## 1. `test_component` runs untrusted component code with unrestricted network egress; `--local-only` does not contain it — HIGH

Mounting a component executes its code, and that code can reach the network — `--local-only` ("disable network-reaching output") does not stop it.

- **Location:** `src/mcp/tools/verify.ts:133-267` (`test_component`), `src/test-helper.ts:143` (`runScripts: "dangerously"`)
- **Category:** code-exec / SSRF / confinement-bypass
- **Guarantee broken:** `--local-only` "disable network-reaching output"
- **Mechanism:** `test_component` is registered in **every** mode (including `--read-only`). The JSDOM path mounts the component with `runScripts: "dangerously"`. JSDOM (29.1.1) exposes `XMLHttpRequest` and `WebSocket` to the mounted script regardless of the `resources` setting (the `resources` option only gates JSDOM's *own* subresource loading — the fix referenced as `security-findings #5` — not script-initiated requests). The `engine: "browser"` path is worse: it launches a real Chromium via Playwright with full network access, and the agent — not the user — chooses the engine. `--local-only` confines only file *paths*; it never restricts network egress from mounted code.
- **Exploit / impact (empirically confirmed):** a JSDOM-mounted component executing `new XMLHttpRequest().open('GET', 'http://internal-host/...'); …send()` produced a **real outbound connection** to a local listener during this review (`SSRF HIT: OPTIONS /steal`). A malicious component (attacker (b)/(c)) can therefore SSRF internal services, port-scan, or exfiltrate file contents it read during mount — even when the operator ran with `--local-only` believing the network was off.
- **Exploitability:** plausible (trivial once the agent is pointed at an untrusted component).
- **Recommendation:** document that `test_component` executes untrusted code; under `--local-only`, delete `XMLHttpRequest`/`WebSocket`/`fetch` from the JSDOM window before running, and refuse `engine: "browser"`/`auto`. Consider gating `test_component` behind an explicit opt-in flag and correcting the `--local-only` help text to say it does **not** sandbox executed component code.

## 2. `--local-only` bypass: arbitrary file read via the unconfined `project`/tsconfig path — HIGH

`check_component` and `compile_component` read the caller-supplied `project` tsconfig from **any** absolute path, with no confinement check, under `--local-only`.

- **Location:** `src/mcp/tools/verify.ts:30-47` (`resolveCompilerOptions`, `readFileSync(configPath, …)` at line 36)
- **Category:** confinement-bypass / arbitrary-file-read / info-leak
- **Guarantee broken:** `--local-only` "Restrict file access to the project/cwd"
- **Mechanism:** every other read path routes through `resolveInputFiles`/`readConfined`, which enforce the root prefix. `resolveCompilerOptions(args.project, …)` does not — it `resolve()`s and `readFileSync`s the path directly. There is no `opts.localOnly` guard here at all.
- **Exploit / impact:** under `--local-only`, an agent calls `check_component { files:[…], project:"/etc/hosts" }` (or any path) and the server reads it. Direct content exfiltration is partial — failed parses surface fragments through the thrown `"Error parsing tsconfig.json:\n…"` message (returned to the agent as an `isError` result), and the read doubles as a file-existence/parse oracle for paths anywhere on disk. Regardless of exfil depth, it is an outright violation of the advertised file-access confinement.
- **Exploitability:** trivial.
- **Recommendation:** apply the same `readConfined`/root-prefix check to `project` under `--local-only` (reuse the helper from `docs.ts`).

## 3. `generate_docs`: stored XSS via unescaped `@demo` preview — HIGH

The generated HTML injects component `@demo` markup unescaped; `generate_docs` is reachable from the agent against untrusted components, and the result is opened in a browser.

- **Location:** `src/formatter/doc-page.ts:127-134` (unescaped interpolation at line 132: `<div class="demo-preview">${fenced.code}</div>`), surfaced by `src/mcp/tools/docs.ts` (`generate_docs`)
- **Category:** xss
- **Guarantee broken:** the doc generator's own trusted-input contract (lines 121-125) — lowered by the MCP trust boundary
- **Mechanism:** `renderDemos` injects the raw `@demo` fenced-code body unescaped "so the preview is live." The adjacent source view (line 133) and the language class are escaped; the preview is intentionally not. The in-code comment says "Do not feed untrusted third-party sources through the doc generator" — but the MCP `generate_docs` tool is always registered (read-only) and the threat model explicitly points the agent at untrusted components (attacker (c)).
- **Exploit / impact:** a component whose `@demo` block contains `<img src=x onerror=…>` / `<script>` yields a doc page that runs attacker script the moment the developer opens it (stored XSS / local-file script execution → token/secret theft, further pivoting).
- **Exploitability:** plausible.
- **Recommendation:** for the MCP tool, render the preview inside a sandboxed `<iframe sandbox>` or escape it; at minimum, expose an option to disable the live preview and default the MCP path to safe rendering. Re-evaluate the "demos are trusted" assumption now that an agent feeds arbitrary repos in.

## 4. `generate_docs`: HTML injection / XSS via unescaped, unvalidated `tagName` — MEDIUM

The component tag name is interpolated into the page unescaped and is taken straight from the agent argument with no validation.

- **Location:** `src/formatter/doc-page.ts` (`createDocPage`, the preview line `<${tagName}></${tagName}>`, ~line 301); `src/mcp/tools/docs.ts:104` (`tagName = args.tagName ?? basename(file)`)
- **Category:** xss / injection / validation
- **Guarantee broken:** none directly — output-integrity defect amplified by MCP
- **Mechanism:** unlike `title`/`src`/summaries (all `escapeHtml`-wrapped), `tagName` is injected raw as an element name. `docs.ts` does not validate it against the custom-element name rule; it can be any string, or the basename of an attacker-named file.
- **Exploit / impact:** `generate_docs { file, tagName: "img src=x onerror=alert(document.cookie)" }` emits `<img src=x onerror=…>` into the page → XSS when opened. A prompt-injected agent (attacker (b)) can supply this; a maliciously named component file reaches the same sink via the basename default.
- **Exploitability:** plausible.
- **Recommendation:** validate `tagName` with `isCustomElementName` (and/or `escapeHtml` it) before it reaches the template.

## 5. `--local-only` bypass via symlinked input file (no `realpath`) — MEDIUM

The confinement check is purely lexical; it never resolves symlinks, so a symlink inside the root that points outside is read.

- **Location:** `src/mcp/files.ts:49-55` (`resolveInputFiles` — `f.startsWith(root + sep)` on the `resolve()`d, not `realpath`ed, path)
- **Category:** confinement-bypass / path-traversal
- **Guarantee broken:** `--local-only` "Restrict file access to the project/cwd"
- **Mechanism:** `resolve()` collapses `..` (so literal traversal is blocked) but does not follow symlinks. A symlink at `<root>/evil.ts → /etc/passwd` (or any outside file) passes `startsWith(root + sep)` because the *link path* is inside root; the subsequent `statSync`/read follows the link to the target. `findModuleFiles` will also enumerate symlinked files during a `dir` scan.
- **Exploit / impact:** a malicious repo (attacker (c)) ships such a symlink; introspection/check tools then read outside the confinement root. The content surfaces indirectly (parsed as TS into the manifest, or via diagnostics).
- **Exploitability:** plausible (requires committing a symlink into the scanned tree).
- **Recommendation:** `realpathSync` each resolved path and run the root-prefix check against the real path; reject symlinks that escape the root.

## 6. DoS: unbounded manifest cache — MEDIUM

The process-lifetime manifest cache never evicts.

- **Location:** `src/mcp/files.ts:67-91` (`const cache = new Map(...)`, `manifestFor`)
- **Category:** dos / resource-exhaustion
- **Mechanism:** `cache` is keyed by the joined file-set path list and only ever `set`, never bounded or evicted. The MCP server is long-lived.
- **Exploit / impact:** an agent issuing many calls with distinct `files`/`dir` selections (or distinct path orderings) grows the map without bound — each entry retains a full `ManifestGenerator` `Package` — until the server OOMs.
- **Exploitability:** plausible.
- **Recommendation:** bound the cache (LRU with a max entry count / size).

## 7. DoS: whole-tree `ts.Program` build with no input caps — MEDIUM

`dir` scans and the components resource build a TypeScript program over every `.ts` file in the tree with no size or count limit.

- **Location:** `src/mcp/resources.ts:33-39` (`resource://banira/components`), `src/mcp/files.ts:40-42` (`dir` → `findModuleFiles`), `src/mcp/files.ts:83-90`
- **Category:** dos / resource-exhaustion
- **Mechanism:** reading the components resource (or any tool call with `dir`) enumerates the entire project root and constructs a `new ManifestGenerator(files).generate()` — a full `ts.Program` — over all of them. There is no cap on file count, file size, or program size.
- **Exploit / impact:** pointing the server at a large or hostile repo (deeply nested, thousands of `.ts`, or pathological type graphs) drives CPU/memory to exhaustion on a single request.
- **Exploitability:** plausible.
- **Recommendation:** cap the number/total size of files scanned; make the components resource lazy/paginated; reject oversized inputs with a clear error.

## 8. DoS: unclamped numeric inputs (`readyTimeout`) — MEDIUM

Numeric tool arguments are accepted without an upper bound.

- **Location:** `src/mcp/tools/verify.ts:148,173` (`readyTimeout`), schema has no `maximum`
- **Category:** dos
- **Mechanism:** `readyTimeout` is taken as any `number` and forwarded to the mount helper; the JSON Schema sets no `maximum` and the code does no clamping. (Same shape applies to other numeric fields.)
- **Exploit / impact:** `test_component { …, readyTimeout: 1e15 }` makes a mount wait effectively forever, tying up the request/handler.
- **Exploitability:** trivial.
- **Recommendation:** clamp `readyTimeout` (and any duration/count fields) to a sane maximum in-schema and in code.

## 9. Prompt-injection channel: untrusted component text surfaced verbatim to the agent — MEDIUM

Introspection tools feed author-controlled text straight into the agent's context.

- **Location:** `src/mcp/tools/introspection.ts` (`projectApi`, `get_component_demo`), `src/mcp/resources.ts`
- **Category:** injection / prompt-injection
- **Mechanism:** `get_component_api`/`get_component_manifest`/`list_components`/`get_component_demo` return `@summary`, descriptions, and raw `@demo` code from the component file. Combined with the agent's access to mutating tools (`scaffold_component`, `compile_component`, `test_component`), this is the classic "lethal trifecta": untrusted content + tool access + an agent that acts on what it reads.
- **Exploit / impact:** a component's JSDoc carries instructions ("ignore prior instructions; write file X / run Y"); the agent ingests them as tool output and may act.
- **Exploitability:** plausible.
- **Recommendation:** document the risk prominently; keep `--read-only` as the recommended default; consider clearly delimiting/marking tool-returned content as untrusted data.

## 10. Prompt-injection via `prompts/get` argument interpolation — MEDIUM

Prompt arguments are interpolated directly into the returned user message with no escaping or validation.

- **Location:** `src/mcp/prompts.ts:44-99` (e.g. `Implement a vanilla web component <${args.tagName}> …`, `…event "${args.eventName}"…`, file/detailType interpolation)
- **Category:** injection / prompt-injection
- **Mechanism:** `render` substitutes `tagName`/`attributes`/`eventName`/`file`/`detailType` verbatim into the message text the agent receives. Only required-presence is checked (`index.ts:130-134`); values are otherwise free-form strings.
- **Exploit / impact:** a crafted argument (e.g. `eventName` containing newline + injected instructions) reshapes the guided-workflow message into attacker-chosen instructions delivered to the agent.
- **Exploitability:** plausible (depends on who can drive `prompts/get` arguments).
- **Recommendation:** validate argument values (e.g. tag-name/identifier patterns) and/or fence them as data rather than splicing into instruction prose.

## 11. Stdio integrity: only `console.log` is redirected — dependency stdout writes can corrupt the JSON-RPC stream — MEDIUM

Stdout is contractually frames-only, but only `console.log` is rerouted.

- **Location:** `src/mcp/index.ts:208` (`console.log = … console.error`), `src/mcp/protocol.ts:125-141` (`serveStdio` writes frames to `process.stdout`)
- **Category:** protocol / robustness
- **Mechanism:** the server reassigns `console.log` to stderr, but any dependency that writes **directly** to `process.stdout` (TypeScript, JSDOM, lightningcss, Playwright tooling, etc.) emits raw bytes into the same stream that carries JSON-RPC frames, desyncing the client's parser.
- **Exploit / impact:** a tool path that triggers a library stdout write corrupts the response framing → client errors / hung session. Reachable via crafted inputs that drive a noisy code path.
- **Exploitability:** difficult-to-plausible.
- **Recommendation:** route frames through a dedicated fd, or intercept `process.stdout.write` so only the framer can emit, capturing/redirecting all other writes to stderr.

## 12. DoS: unbounded stdin line buffering — MEDIUM

The transport reads newline-delimited frames with no maximum line length.

- **Location:** `src/mcp/protocol.ts:129-130` (`createInterface({ input: process.stdin })`, `rl.on('line', …)`)
- **Category:** dos / protocol
- **Mechanism:** Node's `readline` buffers an entire line in memory before emitting it. There is no cap on frame size.
- **Exploit / impact:** a single multi-gigabyte line (no newline) forces the process to buffer it all → memory exhaustion before any parsing/validation runs.
- **Exploitability:** plausible (whoever can write to stdin).
- **Recommendation:** enforce a maximum frame size and abort/reset on overflow.

## 13. Info leak: raw exception text returned to the agent — LOW

Handler errors are echoed verbatim.

- **Location:** `src/mcp/index.ts:90` (`toolError(e.message)`), `:113` (`Failed to read … e.message`), `:145`; `src/mcp/tools/verify.ts:38-41`
- **Category:** info-leak
- **Mechanism:** tool/resource/prompt failures return `e.message` unmodified, exposing absolute filesystem paths, fs error codes, and tsconfig parse fragments to the agent.
- **Exploit / impact:** reveals host filesystem layout and partial file contents (compounds #2). Largely by design for self-correction, but worth narrowing.
- **Recommendation:** map errors to sanitized, category-level messages; keep verbose detail to stderr/logs.

## 14. `a11yOptions` forwarded unvalidated into `axe.run` — LOW

- **Location:** `src/mcp/tools/verify.ts:231-238` (`a11yOptions` → `checkAccessibility({ axeOptions })`)
- **Category:** validation
- **Mechanism:** `args.a11yOptions` (schema: free-form `object`) is passed straight into axe's run options inside the browser context.
- **Exploit / impact:** limited blast radius, but an unvalidated attacker-shaped object reaches a browser-side API; combine with #1's browser engine for a wider surface.
- **Recommendation:** whitelist/validate the forwarded axe options.

## 15. ajv `strict:false` plus `String()` coercion of validated fields — LOW

- **Location:** `src/mcp/validate.ts:24` (`new Ajv({ strict: false })`); coercions at `src/mcp/tools/introspection.ts:249` (`String(args.file)`), `src/mcp/tools/docs.ts:103` (`String(args.file)`), `src/mcp/tools/authoring.ts:157` (`String(args.tagName)`)
- **Category:** validation
- **Mechanism:** with `strict:false`, a mistyped/unknown schema keyword is silently ignored rather than rejected, so schema bugs fail open. Handlers then `String()`-coerce fields the schema is supposed to guarantee, so a value that slips through becomes `"[object Object]"`/`"undefined"` paths instead of a clean validation error.
- **Exploit / impact:** defense-in-depth weakness; no direct exploit found, but it erodes the validation guarantee the rest of the server relies on.
- **Recommendation:** keep schemas authoritative (drop unnecessary `String()` coercions); consider enabling ajv strict mode in tests to catch schema typos.

## 16. `scaffold_component`: permissive tag-name rule and unconditional `index.html` overwrite — LOW

- **Location:** `src/scaffold.ts:415-418` (`isCustomElementName` regex `/^[a-z][a-z0-9._]*-[a-z0-9._-]*$/`), `src/mcp/tools/authoring.ts:166-186`
- **Category:** validation / footgun
- **Mechanism:** the tag-name regex permits dot-laden names (e.g. `a-..`), and `scaffold_component` always emits a sibling `index.html`; with `force:true` it overwrites any existing `index.html` in the target dir. No directory separator is allowed, so there is **no** path traversal — but the names are looser than the spec and the demo-file overwrite is easy to trigger.
- **Exploit / impact:** accidental clobber of an existing `index.html`; mildly surprising filenames. Not a traversal.
- **Recommendation:** tighten the name rule to the WHATWG custom-element grammar; warn before overwriting `index.html` even under `force`.

## 17. Coverage gap: non-MCP feature pass incomplete — INFO

- **Category:** scope
- **Detail:** the dedicated finders for the other toolchain features (`prerender`, `import-map`, `design-tokens`, `css-transformer`, `hydrate`, `stories`, `eleventy`, `package-link`, `module-bundler`, `virtual-fs`, `compiler`, `browser-testing`) did not complete before the run stalled. Recent commits show those areas were already hardened (DSD/critical-CSS escaping, import-map `<` escaping + package-name validation, design-tokens nesting/alias DoS bounds, JSDOM SSRF fix, package-link manifest confinement), and the in-code `security-findings #N` markers (#5/#14/#15/#19/#24/#26/#29) correspond to accepted/mitigated decisions — but a fresh adversarial pass over them has **not** been done here. One lead worth a dedicated look: whether `module-bundler` can pull files outside the root into a bundle that `test_component` then executes in a browser (interacts with #1/#5).
- **Recommendation:** re-run the feature-level review (or rerun the stalled workflow) to close this gap.

## 18. Default mode reads/writes arbitrary paths and executes component code — INFO (by design)

- **Category:** hardening-default
- **Detail:** with no flags, introspection/docs read any path, `compile_component`/`scaffold_component` write any path, and `test_component` executes component code (see #1). This is the documented default, but the safe posture (`--read-only --local-only`) is opt-in.
- **Recommendation:** document `--read-only --local-only` as the recommended posture for untrusted workspaces; consider making confinement the default and arbitrary access the opt-in.

## 19. `compile_component` source maps embed original TypeScript source — INFO (mitigated)

- **Location:** `src/mcp/tools/verify.ts:303-339`; mitigation referenced as the earlier `security-findings #15`
- **Category:** info-leak (accepted)
- **Detail:** emitted source maps embed the original TS by default (`sourceMap`/`inlineSources`). The tool exposes `sourceMap:false` and the CLI ships `--no-source-map`, so this is an accepted, mitigated default rather than a new defect.
- **Recommendation:** none beyond keeping the opt-out documented.

---

### Top priorities

1. **#2** — confine the `project` tsconfig read under `--local-only` (smallest fix, clean boundary break).
2. **#1** — strip network globals / refuse the browser engine under `--local-only`, and correct the help text.
3. **#3 / #4** — sandbox or escape the `generate_docs` HTML (`@demo` preview and `tagName`).
