export { Compiler } from './compiler.js';
export type { CompilerResult } from './compiler.js';
export { ResultAnalyzer } from './result-analyzer.js';
export type { DiagResult } from './result-analyzer.js';
export { createVirtualCompilerHost } from './virtual-fs.js';
export type { VirtualCompilerHost, VirtualFileSystemOptions } from './virtual-fs.js';
export { TestHelper } from './test-helper.js';
export type { MountContext, BrowserMountContext } from './test-helper.js';
export { DocGen } from './doc-gen.js';
export type { DocGenOptions, Stylesheet } from './doc-gen.js';
export { ManifestGenerator } from './manifest.js';
export { bundleModule } from './module-bundler.js';
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
export { validateManifest, formatValidationIssues } from './manifest-validate.js';
export type { ValidationIssue } from './manifest-validate.js';
export { toVsCodeHtmlData, toVsCodeCssData, toWebTypes } from './editor-data.js';
export type { VsCodeHtmlData, VsCodeCssData, WebTypes, WebTypesOptions } from './editor-data.js';
export { toTypeDefinitions } from './type-shims.js';
export type { TypeShimOptions } from './type-shims.js';
export { diffManifests, formatManifestDiff } from './manifest-diff.js';
export type { ManifestDiff, Change, ChangeKind, ReleaseType } from './manifest-diff.js';
export { smokeTestManifest, formatSmokeResults } from './smoke-test.js';
export type { SmokeResult, SmokeOptions } from './smoke-test.js';
export { scaffoldComponent } from './scaffold.js';
export type { ScaffoldFile } from './scaffold.js';
export { prerenderManifest, declarativeShadowDom } from './prerender.js';
export type { PrerenderResult, PrerenderOptions } from './prerender.js';