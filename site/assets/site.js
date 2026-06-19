// banira.js website — shared behavior. Loaded on every page.
// Vanilla, no framework — the site is itself a small demonstration of the pitch.

// ── <my-button> : a genuine vanilla custom element, shadow DOM, the very thing
//    banira is built to develop. Powers the landing-page live demo. Defining it
//    site-wide is harmless; it only renders where the tag is used.
class MyButton extends HTMLElement {
  static observedAttributes = ['variant', 'size', 'disabled'];
  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
  }
  attributeChangedCallback() { if (this.shadowRoot) this.render(); }
  render() {
    const variant = this.getAttribute('variant') || 'primary';
    const size = this.getAttribute('size') || 'md';
    const disabled = this.hasAttribute('disabled');
    const pad = size === 'sm' ? '8px 16px' : size === 'lg' ? '16px 34px' : '12px 26px';
    const fs = size === 'sm' ? '.85rem' : size === 'lg' ? '1.18rem' : '1rem';
    let look = '';
    if (variant === 'primary')        look = 'background:var(--accent); color:#1c1710; border:1px solid var(--accent);';
    else if (variant === 'secondary') look = 'background:transparent; color:var(--accent); border:1.5px solid var(--accent);';
    else                              look = 'background:transparent; color:var(--text); border:1.5px solid transparent;';
    this.shadowRoot.innerHTML =
      '<button part="button" ' + (disabled ? 'disabled' : '') + ' style="' +
      "font-family:'Space Grotesk',sans-serif; font-weight:600; border-radius:11px;" +
      'transition:transform .12s ease, filter .12s ease;' +
      'padding:' + pad + '; font-size:' + fs + ';' +
      'cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';' +
      'opacity:' + (disabled ? '.45' : '1') + ';' + look + '">' +
      '<slot></slot></button>';
  }
}
if (!customElements.get('my-button')) customElements.define('my-button', MyButton);

// ── theme toggle (persisted, defaults to system preference) ──
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const stored = localStorage.getItem('banira-theme');
  const prefersDark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = stored || (prefersDark ? 'dark' : 'light');
  const apply = t => { root.dataset.theme = t; if (btn) btn.textContent = t === 'dark' ? '☀' : '☾'; };
  apply(initial);
  if (btn) btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('banira-theme', next);
    apply(next);
  });
})();

// ── copy buttons ──
document.querySelectorAll('.copy').forEach(btn => {
  const original = btn.innerHTML;
  let t;
  btn.addEventListener('click', () => {
    const text = btn.getAttribute('data-copy').replace(/&#10;/g, '\n');
    navigator.clipboard?.writeText(text).catch(() => {});
    btn.innerHTML = '<span class="ok">✓ copied</span>';
    clearTimeout(t);
    t = setTimeout(() => { btn.innerHTML = original; }, 1600);
  });
});

// ── live demo controls (landing only) ──
(function () {
  const el = document.getElementById('demoBtn');
  if (!el) return;
  const curVariant = document.getElementById('curVariant');
  const curSize = document.getElementById('curSize');
  const count = document.getElementById('clickCount');

  document.querySelectorAll('.seg[data-attr]').forEach(seg => {
    seg.addEventListener('click', () => {
      const attr = seg.dataset.attr, val = seg.dataset.val;
      el.setAttribute(attr, val);
      document.querySelectorAll('.seg[data-attr="' + attr + '"]').forEach(s =>
        s.setAttribute('aria-pressed', String(s === seg)));
      if (attr === 'variant' && curVariant) curVariant.textContent = val;
      if (attr === 'size' && curSize) curSize.textContent = val;
    });
  });

  const dis = document.getElementById('toggleDisabled');
  if (dis) dis.addEventListener('click', () => {
    const on = el.hasAttribute('disabled');
    if (on) el.removeAttribute('disabled'); else el.setAttribute('disabled', '');
    dis.setAttribute('aria-pressed', String(!on));
  });

  let n = 0;
  el.addEventListener('click', () => {
    if (el.hasAttribute('disabled')) return;
    if (count) count.textContent = String(++n);
  });
})();

// ── code tabs (landing only) ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    document.querySelectorAll('.panel').forEach(p => {
      if (p.dataset.panel === name) p.setAttribute('data-active', ''); else p.removeAttribute('data-active');
    });
  });
});
