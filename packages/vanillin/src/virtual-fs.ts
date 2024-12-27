import { Dirent } from 'memfs/lib/Dirent';
import { Dirent as FsDirent } from 'fs';
import { Volume } from 'memfs';
import { CompilerHost, ScriptTarget, createSourceFile } from 'typescript';
import { dirname } from 'path';

export interface VirtualFileSystemOptions {
    files: { [path: string]: string }
    cwd?: string
}

export interface VirtualCompilerHost extends CompilerHost {
    volume: InstanceType<typeof Volume>;
}

export function createVirtualCompilerHost(options: VirtualFileSystemOptions): VirtualCompilerHost {
    const volume = Volume.fromJSON(options.files);

    return {
        volume,
        getSourceFile: (fileName: string, languageVersion: ScriptTarget) => {
            try {
                const sourceText = volume.readFileSync(fileName, 'utf8');
                return createSourceFile(fileName, sourceText.toString(), languageVersion);
            } catch {
                return undefined;
            }
        },
        getDefaultLibFileName: options => options.target === ScriptTarget.ES5 ? 'lib.d.ts' : 'lib.es6.d.ts',
        writeFile: (fileName: string, data: string) => {
            const dir = dirname(fileName);
            if (!volume.existsSync(dir)) {
                volume.mkdirSync(dir, { recursive: true });
            }
            volume.writeFileSync(fileName, data);
        },
        fileExists: (fileName: string) => {
            return volume.existsSync(fileName);
        },
        readFile: (fileName: string): string | undefined => {
            try {
                return volume.readFileSync(fileName, 'utf8').toString();
            } catch {
                return undefined;
            }
        },
        directoryExists: (directoryName: string) => {
            return volume.existsSync(directoryName);
        },
        getCurrentDirectory: () => options.cwd || process.cwd(),
        getCanonicalFileName: fileName => fileName,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
    };
}
