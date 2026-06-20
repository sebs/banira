export { Compiler } from './compiler.js';
export type { CompilerResult } from './compiler.js';
export { ResultAnalyzer } from './result-analyzer.js';
export type { DiagResult } from './result-analyzer.js';
export { createVirtualCompilerHost } from './virtual-fs.js';
export type { VirtualCompilerHost, VirtualFileSystemOptions } from './virtual-fs.js';
export { TestHelper } from './test-helper.js';
export type {
    MountContext,
    BrowserMountContext,
    A11yOptions,
    ScreenshotOptions,
    MatchScreenshotOptions,
} from './test-helper.js';
export {
    summarizeA11y,
    formatA11yViolations,
    resolveBaselinePath,
    actualPathFor,
    buffersEqual,
} from './browser-testing.js';
export type { A11yViolation, A11yResult, RawAxeResults, ScreenshotResult } from './browser-testing.js';
export { DocGen } from './doc-gen.js';
export type { DocGenOptions, Stylesheet } from './doc-gen.js';
export { ManifestGenerator, eventTypeText } from './manifest.js';
export { lowerCssImports, isCssModuleNotFoundDiagnostic } from './css-transformer.js';
export type { CssLoweringOptions } from './css-transformer.js';
export { bundleModule } from './module-bundler.js';
export { transpileToEsm } from './transpile-module.js';
export type {
    Package,
    Module,
    CustomElementDeclaration,
    Attribute,
    ClassMember,
    ClassField,
    ClassMethod,
    Parameter,
    CemEvent,
    NamedDoc,
    CssCustomProperty,
} from './manifest.js';
export { manifestToMarkdown } from './manifest-markdown.js';
export type { MarkdownOptions } from './manifest-markdown.js';
export { collectDesignTokens, designTokensToMarkdown } from './design-tokens.js';
export type { DesignToken, ComponentTokens, DesignTokensOptions } from './design-tokens.js';
export {
    parseDesignTokens,
    designTokensToCss,
    tokensToCssProperties,
    enrichManifestCssProperties,
} from './design-tokens.js';
export type { ImportedToken } from './design-tokens.js';
export { validateManifest, formatValidationIssues } from './manifest-validate.js';
export type { ValidationIssue } from './manifest-validate.js';
export { validateManifestSchema, SchemaValidatorUnavailableError } from './manifest-schema.js';
export { CEM_SCHEMA } from './cem-schema.js';
export { linkManifestField } from './package-link.js';
export type { LinkManifestResult } from './package-link.js';
export { toVsCodeHtmlData, toVsCodeCssData, toWebTypes } from './editor-data.js';
export type { VsCodeHtmlData, VsCodeCssData, WebTypes, WebTypesOptions } from './editor-data.js';
export { toTypeDefinitions } from './type-shims.js';
export type { TypeShimOptions } from './type-shims.js';
export { diffManifests, formatManifestDiff } from './manifest-diff.js';
export type { ManifestDiff, Change, ChangeKind, ReleaseType } from './manifest-diff.js';
export { smokeTestManifest, formatSmokeResults } from './smoke-test.js';
export type { SmokeResult, SmokeOptions } from './smoke-test.js';
export { scaffoldComponent, scaffoldTheme } from './scaffold.js';
export type { ScaffoldFile, ScaffoldOptions, ThemeScaffoldOptions } from './scaffold.js';
export {
    isBareSpecifier,
    packageNameOf,
    scanSpecifiers,
    collectBareSpecifiers,
    generateImportMap,
    buildImportMap,
    readPackageJson,
    importMapScript,
    findModuleFiles,
} from './import-map.js';
export type { ImportMap, ImportMapOptions, PackageJsonLike } from './import-map.js';
export {
    supportsScopedRegistries,
    createScopedRegistry,
    defineComponent,
    attachScopedShadow,
} from './scoped-registry.js';
export type { RegistryLike, RegistryScope, ScopedShadowHost } from './scoped-registry.js';
export { installHmr, HMR_CLIENT_SCRIPT, hmrMessage } from './hmr-client.js';
export { prerenderManifest, declarativeShadowDom } from './prerender.js';
export type { PrerenderResult, PrerenderOptions } from './prerender.js';