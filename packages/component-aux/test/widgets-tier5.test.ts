import './setup.js';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { flush } from './setup.js';
import '../src/index.js';
import { bandResponseDb, combinedResponseDb, type FilterBand } from '../src/core/biquad.js';
import type { AuxEqualizer } from '../src/widgets/aux-equalizer.js';
import type { AuxDynamics } from '../src/widgets/aux-dynamics.js';
import type { AuxMatrix } from '../src/widgets/aux-matrix.js';

afterEach(() => {
    document.body.innerHTML = '';
});

describe('biquad response', () => {
    it('peaking filter boosts near its centre frequency', () => {
        const band: FilterBand = { type: 'peaking', freq: 1000, gain: 12, q: 1 };
        const atCentre = bandResponseDb(band, 1000);
        const farAway = bandResponseDb(band, 50);
        assert.ok(Math.abs(atCentre - 12) < 0.5, `centre ≈ +12dB, got ${atCentre}`);
        assert.ok(Math.abs(farAway) < 1, `far away ≈ 0dB, got ${farAway}`);
    });

    it('disabled bands contribute nothing', () => {
        const band: FilterBand = { type: 'peaking', freq: 1000, gain: 12, q: 1, enabled: false };
        assert.equal(bandResponseDb(band, 1000), 0);
    });

    it('combined response sums the bands', () => {
        const bands: FilterBand[] = [
            { type: 'peaking', freq: 1000, gain: 6, q: 1 },
            { type: 'peaking', freq: 1000, gain: 6, q: 1 },
        ];
        const combined = combinedResponseDb(bands, 1000);
        assert.ok(Math.abs(combined - 12) < 1, `two +6dB ≈ +12dB, got ${combined}`);
    });

    it('lowpass attenuates above the corner', () => {
        const band: FilterBand = { type: 'lowpass', freq: 1000, gain: 0, q: 0.707 };
        assert.ok(bandResponseDb(band, 8000) < -10, 'well below corner gain');
    });
});

describe('aux-equalizer', () => {
    it('produces a flat curve with no bands and a bump with one', () => {
        const eq = document.createElement('aux-equalizer') as unknown as AuxEqualizer;
        document.body.appendChild(eq);
        const flat = eq.responseCurve(8).map((p) => p[1]);
        assert.ok(flat.every((g) => Math.abs(g) < 1e-6), 'flat without bands');
        eq.bands = [{ type: 'peaking', freq: 1000, gain: 12, q: 1 }];
        const peak = Math.max(...eq.responseCurve(200).map((p) => p[1]));
        assert.ok(peak > 6, `curve should bump up, peak ${peak}`);
    });
});

describe('aux-dynamics', () => {
    it('compressor: unity below threshold, reduced above', () => {
        const d = document.createElement('aux-dynamics') as unknown as AuxDynamics & HTMLElement;
        d.setAttribute('type', 'compressor');
        d.setAttribute('threshold', '-20');
        d.setAttribute('ratio', '4');
        document.body.appendChild(d);
        assert.equal(d.transfer(-30), -30, 'unity below threshold');
        // 10 dB over threshold at 4:1 → 2.5 dB over → -17.5
        assert.ok(Math.abs(d.transfer(-10) - -17.5) < 0.01, `got ${d.transfer(-10)}`);
    });

    it('gate: unity above threshold, attenuated below', () => {
        const g = document.createElement('aux-dynamics') as unknown as AuxDynamics & HTMLElement;
        g.setAttribute('type', 'gate');
        g.setAttribute('threshold', '-40');
        document.body.appendChild(g);
        assert.equal(g.transfer(-20), -20, 'unity above threshold');
        assert.ok(g.transfer(-50) < -50, 'attenuated below threshold');
    });
});

describe('aux-matrix', () => {
    it('toggles connections and emits toggle', async () => {
        const m = document.createElement('aux-matrix') as unknown as AuxMatrix & HTMLElement;
        m.sources = [{ id: 'a', label: 'A' }];
        m.sinks = [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }];
        document.body.appendChild(m);
        let last: { source?: string; sink?: string; connected?: boolean } = {};
        m.addEventListener('toggle', (e) => (last = (e as CustomEvent).detail));
        assert.equal(m.hasConnection('a', 'x'), false);
        await flush();
        const cell = m.shadowRoot!.querySelector('[data-source="a"][data-sink="x"]') as HTMLElement;
        cell.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        assert.equal(m.hasConnection('a', 'x'), true);
        assert.deepEqual(last, { source: 'a', sink: 'x', connected: true });
        m.disconnect('a', 'x');
        assert.equal(m.hasConnection('a', 'x'), false);
    });
});
