import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    summarizeA11y,
    formatA11yViolations,
    resolveBaselinePath,
    actualPathFor,
    buffersEqual,
} from '../src/index.js';

describe('accessibility helpers (issue #14)', () => {
    it('summarizes a clean axe run as passed', () => {
        const result = summarizeA11y({ violations: [], incomplete: [] });
        assert.strictEqual(result.passed, true);
        assert.strictEqual(result.violations.length, 0);
        assert.strictEqual(result.incomplete, 0);
    });

    it('flattens violations and node counts', () => {
        const result = summarizeA11y({
            violations: [
                {
                    id: 'color-contrast',
                    impact: 'serious',
                    description: 'Elements must have sufficient color contrast',
                    help: 'Ensure contrast',
                    helpUrl: 'https://example.test/color-contrast',
                    nodes: [{}, {}],
                },
            ],
            incomplete: [{}],
        });
        assert.strictEqual(result.passed, false);
        assert.strictEqual(result.violations[0]!.nodes, 2);
        assert.strictEqual(result.violations[0]!.impact, 'serious');
        assert.strictEqual(result.incomplete, 1);
    });

    it('formats a readable report', () => {
        const result = summarizeA11y({
            violations: [{ id: 'label', impact: 'critical', help: 'Add a label', helpUrl: 'u', nodes: [{}] }],
        });
        const report = formatA11yViolations(result);
        assert.match(report, /label \(critical\): Add a label/);
        assert.strictEqual(formatA11yViolations(summarizeA11y({ violations: [] })), 'No accessibility violations.');
    });
});

describe('visual snapshot helpers (issue #15)', () => {
    it('resolves and sanitizes baseline paths', () => {
        assert.strictEqual(resolveBaselinePath('__screenshots__', 'my widget'), '__screenshots__/my-widget.png');
        assert.strictEqual(resolveBaselinePath('shots/', 'a.png'), 'shots/a.png');
    });

    it('derives the actual-mismatch path', () => {
        assert.strictEqual(actualPathFor('shots/x.png'), 'shots/x.actual.png');
    });

    it('compares buffers byte-for-byte', () => {
        assert.strictEqual(buffersEqual(Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3])), true);
        assert.strictEqual(buffersEqual(Buffer.from([1, 2, 3]), Buffer.from([1, 2, 4])), false);
        assert.strictEqual(buffersEqual(Buffer.from([1, 2]), Buffer.from([1, 2, 3])), false);
    });
});
