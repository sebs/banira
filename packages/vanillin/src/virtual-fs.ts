import { Volume } from 'memfs';
import { CompilerHost, ScriptTarget, createSourceFile } from 'typescript';
import { dirname } from 'path';

/**
 * Configuration options for creating a virtual file system
 * 
 * @interface VirtualFileSystemOptions
 * @property {Object.<string, string>} files - Map of file paths to their contents
 * @property {string} [cwd] - Optional current working directory
 * 
 * @example
 * ```typescript
 * const options: VirtualFileSystemOptions = {
 *   files: {
 *     '/src/component.ts': 'export class MyComponent extends HTMLElement {}',
 *     '/src/index.ts': 'export * from "./component"'
 *   },
 *   cwd: '/src'
 * };
 * ```
 */
export interface VirtualFileSystemOptions {
    files: { [path: string]: string }
    cwd?: string
}

/**
 * Extended TypeScript CompilerHost that includes a virtual filesystem
 * 
 * @interface VirtualCompilerHost
 * @extends {CompilerHost}
 * @property {Volume} volume - The memfs Volume instance representing the virtual filesystem
 */
export interface VirtualCompilerHost extends CompilerHost {
    volume: InstanceType<typeof Volume>;
}

/**
 * Creates a TypeScript compiler host that uses a virtual filesystem
 * 
 * @remarks
 * This function creates a compiler host that uses memfs for file operations
 * instead of the real filesystem. This is particularly useful for:
 * - Testing TypeScript compilation without touching the disk
 * - Running TypeScript compilation in environments without filesystem access
 * - Isolating compilation processes from each other
 * 
 * The created host implements all required CompilerHost methods using the virtual
 * filesystem, including file reading/writing, directory operations, and path resolution.
 * 
 * @param options - Configuration options for the virtual filesystem
 * @returns A compiler host that uses a virtual filesystem
 * 
 * @example
 * ```typescript
 * const host = createVirtualCompilerHost({
 *   files: {
 *     '/src/component.ts': 'export class MyComponent extends HTMLElement {}'
 *   }
 * });
 * 
 * const program = ts.createProgram(['/src/component.ts'], {
 *   target: ts.ScriptTarget.ES2015
 * }, host);
 * ```
 */
export function createVirtualCompilerHost(options: VirtualFileSystemOptions): VirtualCompilerHost {
    const volume = Volume.fromJSON(options.files);

    return {
        volume,
        /**
         * Gets a source file from the virtual filesystem
         * @param fileName - Path to the source file
         * @param languageVersion - TypeScript language version target
         */
        getSourceFile: (fileName: string, languageVersion: ScriptTarget) => {
            try {
                const sourceText = volume.readFileSync(fileName, 'utf8');
                return createSourceFile(fileName, sourceText.toString(), languageVersion);
            } catch {
                return undefined;
            }
        },
        /**
         * Gets the appropriate TypeScript lib file name based on the target
         */
        getDefaultLibFileName: options => options.target === ScriptTarget.ES5 ? 'lib.d.ts' : 'lib.es6.d.ts',
        /**
         * Writes a file to the virtual filesystem
         * @param fileName - Path where to write the file
         * @param data - Content to write
         */
        writeFile: (fileName: string, data: string) => {
            const dir = dirname(fileName);
            if (!volume.existsSync(dir)) {
                volume.mkdirSync(dir, { recursive: true });
            }
            volume.writeFileSync(fileName, data);
        },
        /**
         * Checks if a file exists in the virtual filesystem
         */
        fileExists: (fileName: string) => {
            return volume.existsSync(fileName);
        },
        /**
         * Reads a file from the virtual filesystem
         */
        readFile: (fileName: string): string | undefined => {
            try {
                return volume.readFileSync(fileName, 'utf8').toString();
            } catch {
                return undefined;
            }
        },
        /**
         * Checks if a directory exists in the virtual filesystem
         */
        directoryExists: (directoryName: string) => {
            return volume.existsSync(directoryName);
        },
        /**
         * Gets the current working directory
         */
        getCurrentDirectory: () => options.cwd || process.cwd(),
        /**
         * Gets the canonical file name (identity function in this case)
         */
        getCanonicalFileName: fileName => fileName,
        /**
         * Indicates that the virtual filesystem is case-sensitive
         */
        useCaseSensitiveFileNames: () => true,
        /**
         * Gets the newline character to use
         */
        getNewLine: () => '\n',
    };
}
