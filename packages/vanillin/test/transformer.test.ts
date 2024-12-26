import * as ts from 'typescript';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import transformer from '../src/transformer.js';

function transform(source: string): string {
    // Create a source file
    const sourceFile = ts.createSourceFile(
        'test.ts',
        source,
        ts.ScriptTarget.Latest,
        true
    );

    // Create a transformer
    const result = ts.transform(sourceFile, [transformer()]);
    const transformedSourceFile = result.transformed[0];
    
    // Create a printer with single quotes
    const printer = ts.createPrinter({
        removeComments: true,
        newLine: ts.NewLineKind.LineFeed,
        // Unfortunately TypeScript's printer doesn't have an option for quote style
        // We'll need to handle the output differently
    });
    
    // Print and normalize quotes
    const printed = printer.printFile(transformedSourceFile);
    return printed.replace(/"/g, "'");
}

describe('Import Path Transformer', () => {
    describe('relative imports', () => {
        it('should append .js to imports without extension', () => {
            const source = `import { something } from './module';`;
            const expected = `import { something } from './module.js';`;
            assert.strictEqual(
                transform(source).trim(),
                expected,
                'Should add .js extension to relative import'
            );
        });

        it('should preserve existing .js extensions', () => {
            const source = `import { something } from './module.js';`;
            const expected = `import { something } from './module.js';`;
            assert.strictEqual(
                transform(source).trim(),
                expected,
                'Should not modify imports that already have .js extension'
            );
        });
    });

    describe('external imports', () => {
        it('should not modify scoped package imports', () => {
            const source = `import { something } from '@scope/package';`;
            const expected = `import { something } from '@scope/package';`;
            assert.strictEqual(
                transform(source).trim(),
                expected,
                'Should not modify scoped package imports'
            );
        });

        it('should not modify node_modules imports', () => {
            const source = `import { something } from 'package-name';`;
            const expected = `import { something } from 'package-name';`;
            assert.strictEqual(
                transform(source).trim(),
                expected,
                'Should not modify node_modules imports'
            );
        });
    });

    describe('multiple imports', () => {
        it('should handle mixed import types correctly', () => {
            const source = `
import { a } from './module-a';
import { b } from '@scope/package';
import { c } from './module-c.js';`;
            const expected = `import { a } from './module-a.js';
import { b } from '@scope/package';
import { c } from './module-c.js';`;
            assert.strictEqual(
                transform(source).trim(),
                expected,
                'Should correctly transform only relative imports without extension'
            );
        });
    });
});
