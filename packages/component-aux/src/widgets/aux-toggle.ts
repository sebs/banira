/**
 * A toggle button — a {@link AuxButton} that flips a boolean `state` on each
 * activation and exposes it via `aria-pressed`.
 *
 * Clean-room reimplementation of AUX's `Toggle` (original code, MIT). Supports
 * distinct active/inactive labels and icons.
 *
 * @demo
 * ```html
 * <aux-toggle label="Mute" label-active="Muted"></aux-toggle>
 * ```
 *
 * @remarks
 * Attributes: all of {@link AuxButton} plus `toggle` (default on),
 * `label-active`, `icon-active`, `icon-inactive`. Emits `toggled` with
 * `{ state }`.
 */
import { AuxButton } from './aux-button.js';

export class AuxToggle extends AuxButton {
    static get observedAttributes(): string[] {
        return [...AuxButton.observedAttributes, 'toggle', 'label-active', 'icon-active', 'icon-inactive'];
    }

    override get label(): string {
        if (this.state && this.hasAttribute('label-active')) {
            return this.getAttribute('label-active') ?? '';
        }
        return this.getAttribute('label') ?? '';
    }
    override set label(v: string) {
        this.setAttribute('label', v);
    }

    override get icon(): string {
        if (this.state) {
            if (this.hasAttribute('icon-active')) return this.getAttribute('icon-active') ?? '';
        } else if (this.hasAttribute('icon-inactive')) {
            return this.getAttribute('icon-inactive') ?? '';
        }
        return this.getAttribute('icon') ?? '';
    }
    override set icon(v: string) {
        this.setAttribute('icon', v);
    }

    protected override activate(): void {
        const canToggle = this.getAttribute('toggle') !== 'false';
        if (canToggle) {
            this.state = !this.state;
            // Reflect ARIA synchronously; render() (async) would lag a click.
            this.setAttribute('aria-pressed', String(this.state));
            this.emit('toggled', { state: this.state });
        } else {
            this.emit('pressed');
        }
    }

    protected override render(): void {
        this.setAttribute('aria-pressed', String(this.state));
        super.render();
    }
}

if (!customElements.get('aux-toggle')) {
    customElements.define('aux-toggle', AuxToggle);
}
