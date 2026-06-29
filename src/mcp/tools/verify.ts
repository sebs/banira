import * as ts from 'typescript';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import {
  Compiler,
  ResultAnalyzer,
  isCssModuleNotFoundDiagnostic,
  TestHelper,
  smokeTestManifest,
  formatSmokeResults,
  bundleModule,
  type SmokeOptions,
  type A11yResult,
} from '../../index.js';
import type { Registries } from '../registry.js';
import type { McpServerOptions } from '../options.js';
import { resolveInputFiles, invalidateManifest } from '../files.js';
import { toDiagItem } from '../diagnostics.js';
import { DIAG_ITEM_SCHEMA } from '../schemas.js';

/**
 * Group 2 — compile & verify. `check_component` type-checks in memory with no
 * disk writes; `test_component` actually mounts the component (JSDOM by default,
 * an optional real browser via Playwright) and reports whether it registers and
 * upgrades cleanly. The ~30-line options resolver is re-implemented here on the
 * public primitives so `src/mcp/` depends only on `../index.js`.
 */

/** Resolve compiler options from the defaults + a `--project` tsconfig + a `strict` override. */
function resolveCompilerOptions(
  project: string | undefined,
  strict: boolean,
  opts: McpServerOptions
): ts.CompilerOptions {
  let compilerOptions: ts.CompilerOptions = { ...Compiler.DEFAULT_COMPILER_OPTIONS };

  if (project) {
    const configPath = resolve(project);
    // Under --local-only the caller-supplied tsconfig is a file read like any
    // other and must stay inside the confinement root — otherwise `project`
    // becomes an arbitrary-file-read (and parse-error info-leak) channel.
    if (opts.localOnly) {
      const root = resolve(opts.project ? dirname(opts.project) : process.cwd());
      if (configPath !== root && !configPath.startsWith(root + sep)) {
        throw new Error(`--local-only: refusing to read tsconfig outside ${root}: ${configPath}`);
      }
    }
    if (!existsSync(configPath)) throw new Error(`tsconfig.json not found at ${configPath}`);
    const { config } = ts.parseConfigFileTextToJson(configPath, readFileSync(configPath, 'utf8'));
    const result = ts.convertCompilerOptionsFromJson(config?.compilerOptions, dirname(configPath));
    if (result.errors.length) {
      const messages = result.errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n');
      throw new Error(`Error parsing tsconfig.json:\n${messages}`);
    }
    compilerOptions = { ...compilerOptions, ...result.options };
  }

  if (strict) compilerOptions.strict = true;
  return compilerOptions;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Upper bound for `readyTimeout` (ms); an unclamped value lets a call hang ~forever. */
const MAX_READY_TIMEOUT = 60_000;

/** Clamp a caller-supplied ms timeout into [0, MAX_READY_TIMEOUT]. See finding #8. */
function clampReadyTimeout(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(value, 0), MAX_READY_TIMEOUT);
}

interface SingleResult {
  ok: boolean;
  queryResults?: Array<{ selector: string; matched: number }>;
}

/** Mount one component in JSDOM and report whether it registered + upgraded. */
async function jsdomSingle(
  file: string,
  tagName: string,
  queryList: string[] | undefined,
  readyTimeout: number | undefined,
  blockNetwork: boolean
): Promise<SingleResult> {
  const helper = new TestHelper();
  if (readyTimeout !== undefined) helper.readyTimeout = readyTimeout;
  if (blockNetwork) helper.blockNetwork = true;
  const ctx = await helper.compileAndMountAsScript(tagName, file);
  try {
    const registered = !!ctx.window.customElements.get(tagName);
    const el = ctx.document.querySelector(tagName);
    const upgraded = el instanceof ctx.window.HTMLElement;
    const out: SingleResult = { ok: registered && upgraded };
    if (queryList && queryList.length) {
      out.queryResults = queryList.map((sel) => ({ selector: sel, matched: ctx.queryAll(sel).length }));
    }
    return out;
  } finally {
    ctx.jsdom.window.close();
  }
}

const PLAYWRIGHT_MISSING = /Real-browser testing requires Playwright/;
const AXE_MISSING = /Accessibility testing requires axe-core/;

/** Register the verify tools: `check_component` (M2) and `test_component` (M4). */
export function registerVerifyTools(registries: Registries, opts: McpServerOptions): void {
  registries.defineTool(
    {
      name: 'check_component',
      title: 'Check component (type-check, no write)',
      description:
        'Type-check the given component file(s) WITHOUT writing any output (in-memory compile). Returns hasErrors plus structured diagnostics so an agent can self-correct after generating code. CSS-module import errors (the `import "./x.css"` lowering pattern) are filtered out as expected, not failures.',
      inputSchema: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' }, description: 'Component .ts files to type-check.' },
          project: { type: 'string', description: 'Path to a tsconfig.json whose options override the defaults.' },
          strict: { type: 'boolean', description: 'Force TypeScript strict mode on.' },
        },
        required: ['files'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          errorCount: { type: 'number' },
          warningCount: { type: 'number' },
          diagnostics: { type: 'array', items: DIAG_ITEM_SCHEMA },
        },
        required: ['ok', 'errorCount', 'warningCount', 'diagnostics'],
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const files = resolveInputFiles(args, opts);
      const compilerOptions = resolveCompilerOptions(
        typeof args.project === 'string' ? args.project : undefined,
        args.strict === true,
        opts
      );
      // withVirtualFs reads inputs from real disk but emits into an in-memory
      // memfs volume — nothing is written to the working tree.
      const compiler = await Compiler.withVirtualFs(files, compilerOptions);
      const diag = new ResultAnalyzer(compiler.emit()).diag();
      const errors = diag.errors.filter((d) => !isCssModuleNotFoundDiagnostic(d));
      return {
        ok: errors.length === 0,
        errorCount: errors.length,
        warningCount: diag.warnings.length,
        diagnostics: [...errors, ...diag.warnings].map(toDiagItem),
      };
    }
  );

  registries.defineTool(
    {
      name: 'test_component',
      title: 'Test component (mount & verify)',
      description:
        'Mount the component(s) and report whether each registers and upgrades cleanly. Read-only: it never writes to disk. Default engine is JSDOM (no browser needed). Pass `files` for a manifest-driven smoke test, or `file`+`tagName` for a single component. `engine: "browser"|"auto"` uses Playwright when available and otherwise degrades to JSDOM (reported in `degraded`). Optional reflection/slot advisory checks, shadow-piercing `query` (JSDOM), and an accessibility scan (axe, browser mode).',
      inputSchema: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' }, description: 'Manifest smoke-test mode: component .ts files.' },
          file: { type: 'string', description: 'Single-component mode: the component .ts file (with tagName).' },
          tagName: { type: 'string', description: 'Single-component mode: the tag name to mount.' },
          engine: { enum: ['jsdom', 'browser', 'auto'], description: 'Default jsdom; browser/auto use Playwright when present.' },
          reflection: { type: 'boolean', description: 'Also run the attribute↔property reflection check (advisory).' },
          slots: { type: 'boolean', description: 'Also check declared @slots project (advisory).' },
          readyTimeout: { type: 'number', minimum: 0, maximum: MAX_READY_TIMEOUT, description: `JSDOM mode only: max ms to wait for the element to register (default 1000, capped at ${MAX_READY_TIMEOUT}).` },
          query: { type: 'array', items: { type: 'string' }, description: 'JSDOM single-component mode only: shadow-piercing selectors to probe.' },
          a11y: { type: 'boolean', description: 'Browser mode: run an axe-core accessibility scan (requires Playwright + axe-core).' },
          a11yOptions: { type: 'object', description: 'axe.run options forwarded to checkAccessibility.' },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          engineUsed: { enum: ['jsdom', 'browser'] },
          ok: { type: 'boolean' },
          components: { type: 'array' },
          report: { type: 'string' },
          summary: { type: 'object' },
          queryResults: { type: 'array' },
          a11y: { type: 'object' },
          degraded: { type: 'object' },
        },
        required: ['engineUsed', 'ok', 'components', 'summary'],
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const engine = typeof args.engine === 'string' ? args.engine : 'jsdom';
      const readyTimeout = clampReadyTimeout(args.readyTimeout);

      // Mounting executes the component's code. Under --local-only, a real
      // browser (Playwright) has unrestricted network access we cannot strip, so
      // refuse it outright; the JSDOM paths run with network globals removed.
      if (opts.localOnly && (engine === 'browser' || engine === 'auto')) {
        throw new Error(
          '--local-only: refusing engine "' + engine + '" (a real browser has unrestricted network access). Use engine "jsdom".'
        );
      }

      // --- Manifest / smoke mode (always JSDOM) ---
      if (Array.isArray(args.files)) {
        const files = resolveInputFiles(args, opts);
        const smokeOptions: SmokeOptions = {};
        if (args.reflection === true) smokeOptions.reflection = true;
        if (args.slots === true) smokeOptions.slots = true;
        if (readyTimeout !== undefined) smokeOptions.readyTimeout = readyTimeout;
        if (opts.localOnly) smokeOptions.blockNetwork = true;
        const results = await smokeTestManifest(files, smokeOptions);
        const components = results.map((r) => ({
          tagName: r.tagName,
          file: r.file,
          ok: r.ok,
          error: r.error,
          reflection: r.reflection,
          slots: r.slots,
        }));
        const passed = components.filter((c) => c.ok).length;
        const warnings = results.reduce((n, r) => n + (r.reflection?.length ?? 0) + (r.slots?.length ?? 0), 0);
        return {
          engineUsed: 'jsdom',
          ok: components.length > 0 && components.every((c) => c.ok),
          components,
          report: formatSmokeResults(results),
          summary: { total: components.length, passed, failed: components.length - passed, warnings },
        };
      }

      // --- Single-component mode ---
      const fileArg = typeof args.file === 'string' ? args.file : undefined;
      const tagName = typeof args.tagName === 'string' ? args.tagName : undefined;
      if (!fileArg || !tagName) {
        throw new Error('Provide either "files" (manifest smoke test) or "file" + "tagName" (single component).');
      }
      const file = resolveInputFiles({ files: [fileArg] }, opts)[0]!;
      const queryList = Array.isArray(args.query)
        ? args.query.filter((q): q is string => typeof q === 'string')
        : undefined;

      let degraded: Record<string, unknown> | undefined;

      // Browser path (Playwright). Falls back to JSDOM when Playwright is absent.
      if (engine === 'browser' || engine === 'auto') {
        try {
          const code = bundleModule(file);
          const bctx = await new TestHelper().mountInBrowser(tagName, code);
          try {
            // mountInBrowser resolves only once customElements.get(tag) is defined,
            // so registration is verified; a real browser upgrades the present
            // element synchronously on define.
            const result: Record<string, unknown> = {
              engineUsed: 'browser',
              ok: true,
              components: [{ tagName, file, ok: true }],
              report: `ok ${tagName} registered (browser)`,
              summary: { total: 1, passed: 1, failed: 0, warnings: 0 },
            };
            if (args.a11y === true) {
              const a11yOptions =
                args.a11yOptions && typeof args.a11yOptions === 'object'
                  ? { axeOptions: args.a11yOptions as Record<string, unknown> }
                  : undefined;
              try {
                const a11y: A11yResult = await bctx.checkAccessibility(a11yOptions);
                result.a11y = a11y;
              } catch (e) {
                if (!AXE_MISSING.test(errMsg(e))) throw e;
                result.degraded = { feature: 'a11y', reason: 'axe-core-not-installed' };
              }
            }
            return result;
          } finally {
            await bctx.close();
          }
        } catch (e) {
          if (!PLAYWRIGHT_MISSING.test(errMsg(e))) throw e;
          degraded = { browserRequested: true, ran: 'jsdom', reason: 'playwright-not-installed' };
          // fall through to JSDOM
        }
      }

      const single = await jsdomSingle(file, tagName, queryList, readyTimeout, opts.localOnly === true);
      const result: Record<string, unknown> = {
        engineUsed: 'jsdom',
        ok: single.ok,
        components: [{ tagName, file, ok: single.ok }],
        report: single.ok ? `ok ${tagName} registered and upgraded` : `fail ${tagName} did not register/upgrade`,
        summary: { total: 1, passed: single.ok ? 1 : 0, failed: single.ok ? 0 : 1, warnings: 0 },
      };
      if (single.queryResults) result.queryResults = single.queryResults;
      if (degraded) result.degraded = degraded;
      return result;
    }
  );

  // compile_component WRITES emitted JS to disk — omit it entirely in read-only mode.
  if (opts.readOnly) return;

  registries.defineTool(
    {
      name: 'compile_component',
      title: 'Compile component (writes JS)',
      description:
        'Compile the given component file(s) to browser-ready ES modules, WRITING .js (+ .js.map) to the output directory (default ./dist). Returns the written output paths plus structured diagnostics. Note: files are emitted even when there are type errors (ok:false with outputs still listed).',
      inputSchema: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' }, description: 'Component .ts files to compile.' },
          project: { type: 'string', description: 'Path to a tsconfig.json whose options override the defaults.' },
          outDir: { type: 'string', description: 'Output directory (default ./dist).' },
          sourceMap: { type: 'boolean', description: 'Emit source maps (default true; maps embed the original TypeScript).' },
          optimizeCss: { type: 'boolean', description: 'Run inlined CSS through lightningcss (requires the optional lightningcss dep).' },
        },
        required: ['files'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          outputs: { type: 'array', items: { type: 'string' } },
          errorCount: { type: 'number' },
          warningCount: { type: 'number' },
          diagnostics: { type: 'array', items: DIAG_ITEM_SCHEMA },
        },
        required: ['ok', 'outputs', 'errorCount', 'warningCount', 'diagnostics'],
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const files = resolveInputFiles(args, opts);
      const compilerOptions = resolveCompilerOptions(typeof args.project === 'string' ? args.project : undefined, false, opts);
      if (typeof args.outDir === 'string') compilerOptions.outDir = resolve(args.outDir);
      if (args.sourceMap === false) {
        compilerOptions.sourceMap = false;
        compilerOptions.inlineSources = false;
      }
      if (opts.localOnly) {
        const root = resolve(opts.project ? dirname(opts.project) : process.cwd());
        const outDir = resolve(typeof compilerOptions.outDir === 'string' ? compilerOptions.outDir : './dist');
        if (outDir !== root && !outDir.startsWith(root + sep)) {
          throw new Error(`--local-only: refusing to write to ${outDir} (outside ${root})`);
        }
      }
      // Real-disk Compiler (not withVirtualFs): emit() writes .js/.js.map. optimizeCss
      // lazily requires lightningcss and throws if it is absent → reported as isError.
      const compiler = new Compiler(
        files,
        compilerOptions,
        undefined,
        args.optimizeCss === true ? { optimizeCss: true } : undefined
      );
      const analyzer = new ResultAnalyzer(compiler.emit());
      const diag = analyzer.diag();
      const errors = diag.errors.filter((d) => !isCssModuleNotFoundDiagnostic(d));
      // The emit changed the working tree — drop any cached manifest for these inputs.
      invalidateManifest(files);
      return {
        ok: errors.length === 0,
        outputs: analyzer.outputFiles,
        errorCount: errors.length,
        warningCount: diag.warnings.length,
        diagnostics: [...errors, ...diag.warnings].map(toDiagItem),
      };
    }
  );
}
