/**
 * A 2D chart with grid and polyline graphs (SVG).
 *
 * Clean-room reimplementation of AUX's `Chart` (original code, MIT). Provides x/y
 * {@link Range}s, a coordinate mapping (`toX`/`toY` and inverses) and grid
 * rendering. Base for {@link AuxEqualizer} and {@link AuxDynamics}.
 *
 * @demo
 * ```html
 * <aux-chart x-min="20" x-max="20000" x-scale="logarithmic" y-min="-24" y-max="24"></aux-chart>
 * ```
 *
 * @remarks
 * Attributes: `width`, `height`, `x-min`, `x-max`, `y-min`, `y-max`, `x-scale`,
 * `y-scale`, `grid`. Set `graphs` (property) to `[{ points: [[x,y]…], color }]`.
 */
import { WidgetBase } from '../core/widget-base.js';
import { Range, type ScaleLaw } from '../core/range.js';

export interface Graph {
    points: Array<[number, number]>;
    color?: string;
    width?: number;
    className?: string;
}

export class AuxChart extends WidgetBase {
    protected xRange = new Range({ min: 0, max: 1 });
    protected yRange = new Range({ min: 0, max: 1 });
    private _graphs: Graph[] = [];

    static get observedAttributes(): string[] {
        return ['width', 'height', 'x-min', 'x-max', 'y-min', 'y-max', 'x-scale', 'y-scale', 'grid'];
    }

    get graphs(): Graph[] {
        return this._graphs;
    }
    set graphs(g: Graph[]) {
        this._graphs = g;
        this.requestUpdate();
    }

    protected get width(): number {
        return this.numAttr('width', 400);
    }
    protected get height(): number {
        return this.numAttr('height', 200);
    }

    connectedCallback(): void {
        this.syncRanges();
        super.connectedCallback();
    }

    attributeChangedCallback(): void {
        this.syncRanges();
        this.requestUpdate();
    }

    private syncRanges(): void {
        this.xRange.set('min', this.numAttr('x-min', 0));
        this.xRange.set('max', this.numAttr('x-max', 1));
        this.xRange.set('scale', (this.getAttribute('x-scale') as ScaleLaw) ?? 'linear');
        this.xRange.set('basis', this.width);
        this.yRange.set('min', this.numAttr('y-min', 0));
        this.yRange.set('max', this.numAttr('y-max', 1));
        this.yRange.set('scale', (this.getAttribute('y-scale') as ScaleLaw) ?? 'linear');
        this.yRange.set('basis', this.height);
    }

    /** Maps a data x value to a pixel x. */
    protected toX(value: number): number {
        return this.xRange.valueToCoef(value) * this.width;
    }
    /** Maps a data y value to a pixel y (origin bottom-left). */
    protected toY(value: number): number {
        return (1 - this.yRange.valueToCoef(value)) * this.height;
    }
    /** Inverse of {@link toX}. */
    protected fromX(px: number): number {
        return this.xRange.coefToValue(px / this.width);
    }
    /** Inverse of {@link toY}. */
    protected fromY(px: number): number {
        return this.yRange.coefToValue(1 - px / this.height);
    }

    /** Builds an SVG polyline `points` attribute from data points. */
    protected polyline(points: Array<[number, number]>): string {
        return points.map(([x, y]) => `${this.toX(x).toFixed(2)},${this.toY(y).toFixed(2)}`).join(' ');
    }

    private gridMarkup(): string {
        if (this.getAttribute('grid') === 'false') return '';
        const w = this.width;
        const h = this.height;
        const lines: string[] = [];
        for (let i = 1; i < 8; i++) {
            const x = (i / 8) * w;
            lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" />`);
        }
        for (let i = 1; i < 4; i++) {
            const y = (i / 4) * h;
            lines.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" />`);
        }
        return `<g class="grid" part="grid">${lines.join('')}</g>`;
    }

    /** Overridable: extra SVG drawn on top of the grid (handles, curves). */
    protected overlayMarkup(): string {
        return this._graphs
            .map(
                (g) =>
                    `<polyline class="graph ${g.className ?? ''}" part="graph" fill="none"
                               stroke="${g.color ?? 'var(--aux-accent, #3b82f6)'}"
                               stroke-width="${g.width ?? 2}" points="${this.polyline(g.points)}" />`
            )
            .join('');
    }

    protected render(): void {
        const w = this.width;
        const h = this.height;
        this.root.innerHTML = `
            <style>
                :host { display: inline-block; }
                svg { width: var(--aux-chart-width, ${w}px); height: var(--aux-chart-height, ${h}px); display: block;
                      background: var(--aux-chart-bg, #1a1a1a); border-radius: 4px; touch-action: none; }
                .grid line { stroke: var(--aux-grid, #333); stroke-width: 1; }
            </style>
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                ${this.gridMarkup()}
                ${this.overlayMarkup()}
            </svg>
        `;
    }
}

if (!customElements.get('aux-chart')) {
    customElements.define('aux-chart', AuxChart);
}
