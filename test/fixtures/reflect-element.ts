/**
 * Exercises the attribute↔property reflection round-trip check: `label`,
 * `count` and `active` reflect both directions; `oneway` reflects attribute→
 * property only (its setter doesn't write the attribute back).
 *
 * @summary Reflection round-trip fixture.
 */
class ReflectElement extends HTMLElement {
    private _oneway: string = '';

    static get observedAttributes(): string[] {
        return ['label', 'count', 'active', 'oneway'];
    }

    /** Reflected string. */
    get label(): string {
        return this.getAttribute('label') ?? '';
    }
    set label(value: string) {
        this.setAttribute('label', value);
    }

    /** Reflected number. */
    get count(): number {
        return Number(this.getAttribute('count') ?? 0);
    }
    set count(value: number) {
        this.setAttribute('count', String(value));
    }

    /** Reflected boolean. */
    get active(): boolean {
        return this.hasAttribute('active');
    }
    set active(value: boolean) {
        if (value) this.setAttribute('active', '');
        else this.removeAttribute('active');
    }

    /** Attribute drives the property, but the setter does NOT reflect back. */
    get oneway(): string {
        return this._oneway;
    }
    set oneway(value: string) {
        this._oneway = value;
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
        if (name === 'oneway') this._oneway = value ?? '';
    }
}

customElements.define('reflect-element', ReflectElement);
