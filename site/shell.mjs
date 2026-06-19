// Page shell: the single source of truth for <head>, nav, and footer.
// Every generated page is wrapped by page(); the landing passes its own body
// fragment, subpages pass prose + an optional sidebar.

const navLink = (href, label, key, active, hideable) =>
  `<a href="${href}" class="nav-link${hideable ? ' nav-hideable' : ''}"` +
  `${key === active ? ' aria-current="page"' : ''}>${label}</a>`;

function head(title, description) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>`;
}

function nav(active) {
  return `
  <header class="nav">
    <nav class="wrap">
      <a href="/" class="brand">
        <span class="logo"><span></span></span>
        <span>banira<span class="accent">.js</span></span>
      </a>
      <div class="grow"></div>
      ${navLink('/docs/getting-started/', 'Docs', 'docs', active)}
      ${navLink('/cli/', 'CLI', 'cli', active)}
      ${navLink('/api/', 'API', 'api', active)}
      ${navLink('https://github.com/sebs/banira', 'GitHub ↗', 'gh', active, true)}
      <button class="theme-btn" id="themeToggle" aria-label="Toggle theme">☾</button>
    </nav>
  </header>`;
}

function footer() {
  return `
  <footer>
    <div class="wrap foot-grid">
      <div>
        <div class="foot-brand">
          <span class="logo"><span></span></span>
          banira<span class="accent">.js</span>
        </div>
        <p class="foot-tag">A toolchain for vanilla web components. No bundler. No framework.</p>
        <p class="foot-meta">MIT · pre-1.0 · sebs/banira</p>
      </div>
      <div class="foot-col">
        <h4>Docs</h4>
        <div class="links">
          <a href="/docs/getting-started/">Getting started</a>
          <a href="/docs/the-toolchain/">The toolchain</a>
          <a href="/docs/authoring-components/">Authoring components</a>
          <a href="/docs/ci-and-release/">CI &amp; release</a>
        </div>
      </div>
      <div class="foot-col cli">
        <h4>CLI</h4>
        <div class="links">
          <a href="/cli/compile/">compile</a>
          <a href="/cli/manifest/">manifest</a>
          <a href="/cli/doc/">doc</a>
          <a href="/cli/types/">types</a>
          <a href="/cli/">all commands →</a>
        </div>
      </div>
      <div class="foot-col">
        <h4>Reference</h4>
        <div class="links">
          <a href="/api/">API (TypeDoc)</a>
          <a href="/playground/">Playground →</a>
        </div>
      </div>
      <div class="foot-col">
        <h4>Project</h4>
        <div class="links">
          <a href="https://github.com/sebs/banira">GitHub ↗</a>
          <a href="https://www.npmjs.com/package/banira">npm ↗</a>
        </div>
      </div>
    </div>
    <div class="wrap foot-rule"><div class="ia">/ landing · /docs · /cli · /api · /playground</div></div>
  </footer>`;
}

// Full page. `content` is raw HTML for the <body> interior (between nav and footer).
export function page({ title, description, active = '', content }) {
  return head(title, description) + nav(active) + content + footer() +
    `\n<script src="/assets/site.js"></script>\n</body>\n</html>\n`;
}

// Convenience: a docs/cli subpage = page hero + (optional) sidebar layout + prose.
export function subpage({ title, description, active, breadcrumb, heading, sub, sidebar, body }) {
  const crumbs = breadcrumb
    .map((c, i) => c.href ? `<a href="${c.href}">${c.label}</a>` : `<span>${c.label}</span>`)
    .join('<span class="sep">/</span>');
  const hero = `
  <section class="page-hero">
    <div class="wrap">
      <nav class="breadcrumb">${crumbs}</nav>
      <h1>${heading}</h1>
      ${sub ? `<p class="sub">${sub}</p>` : ''}
    </div>
  </section>`;
  const main = sidebar
    ? `<div class="wrap layout">${sidebar}<div class="prose">${body}</div></div>`
    : `<div class="wrap" style="padding-bottom:70px;"><div class="prose" style="max-width:none;">${body}</div></div>`;
  return page({ title, description, active, content: hero + main });
}
