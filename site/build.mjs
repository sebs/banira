// Zero-dependency static site generator for the banira.js website.
//
//   node site/build.mjs            → builds the site into _site/
//   node site/build.mjs <outDir>   → builds into <outDir>/
//
// The CI Pages workflow runs this, then drops the generated TypeDoc reference
// into <outDir>/api. Nothing here is committed; the whole site is assembled
// fresh from source.

import { mkdirSync, rmSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { page, subpage } from './shell.mjs';
import { guides } from './docs.mjs';
import { commands } from './cli.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] || join(here, '..', '_site'));

// GitHub Pages serves this project under https://sebs.github.io/banira/, so every
// root-absolute link (href="/…", src="/…") must carry that base prefix or it
// resolves to the domain root and 404s. Override with SITE_BASE='' for a
// custom domain served from the root. Trailing slash is normalized off.
const BASE = (process.env.SITE_BASE ?? '/banira').replace(/\/$/, '');
const withBase = html => BASE ? html.replace(/(href|src)="\//g, `$1="${BASE}/`) : html;

const write = (rel, html) => {
  const file = join(out, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, withBase(html));
};

// ── reset + static assets ──
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(here, 'assets'), join(out, 'assets'), { recursive: true });

// ── landing ──
const landing = readFileSync(join(here, 'landing.html'), 'utf8');
write('index.html', page({
  title: 'banira.js — A toolchain for vanilla web components',
  description: 'An open-source toolchain for developing web components with vanilla JavaScript. No bundler, no framework — a CLI that compiles, documents, and type-checks your components.',
  active: 'home',
  content: landing,
}));

// ── docs sidebar (shared across guides) ──
const docsSidebar = current => `<aside class="sidebar"><div class="group"><h4>Guides</h4>` +
  guides.map(g => `<a href="/docs/${g.slug}/"${g.slug === current ? ' aria-current="page"' : ''}>${g.label}</a>`).join('') +
  `</div></aside>`;

// ── docs index ──
write('docs/index.html', subpage({
  title: 'Docs — banira.js',
  description: 'Guides for developing vanilla web components with banira.',
  active: 'docs',
  breadcrumb: [{ label: 'banira.js', href: '/' }, { label: 'Docs' }],
  heading: 'Documentation',
  sub: 'Conceptual guides for building, documenting and shipping vanilla web components with banira.',
  sidebar: docsSidebar(null),
  body: `<div class="next-grid">` + guides.map(g =>
    `<a class="next-card" href="/docs/${g.slug}/"><span class="k">guide</span><div class="t">${g.label}</div><div class="d">${g.sub}</div></a>`
  ).join('') + `</div>`,
}));

// ── docs guides ──
for (const g of guides) {
  write(`docs/${g.slug}/index.html`, subpage({
    title: g.title,
    description: g.desc,
    active: 'docs',
    breadcrumb: [{ label: 'banira.js', href: '/' }, { label: 'Docs', href: '/docs/' }, { label: g.label }],
    heading: g.label,
    sub: g.sub,
    sidebar: docsSidebar(g.slug),
    body: g.body,
  }));
}

// ── cli helpers ──
const cliSidebar = current => `<aside class="sidebar cli"><div class="group"><h4>Commands</h4>` +
  `<a href="/cli/"${current === null ? ' aria-current="page"' : ''}>overview</a>` +
  commands.map(c => `<a href="/cli/${c.name}/"${c.name === current ? ' aria-current="page"' : ''}>${c.name}</a>`).join('') +
  `</div></aside>`;

const usageLine = c => {
  const args = c.args.map(a => a.optional ? `<span class="opt">[${a.name}]</span>` : `<span class="arg">&lt;${a.name}&gt;</span>`).join(' ');
  const opts = c.options.length ? ' <span class="opt">[options]</span>' : '';
  return `<div class="usage"><span class="dim">$</span> <span class="b">banira</span> ${c.name} ${args}${opts}</div>`;
};

const esc = s => s.replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;');

const cmdBody = c => {
  let html = `<p style="font-size:1.05rem; line-height:1.6; color:var(--muted);">${c.summary}</p>`;
  html += `<h2 id="usage">Usage</h2>` + usageLine(c);

  if (c.args.length) {
    html += `<h2 id="arguments">Arguments</h2><div class="table-wrap"><table class="opt"><thead><tr><th>Argument</th><th>Description</th></tr></thead><tbody>`;
    for (const a of c.args) {
      const def = a.default ? ` <span class="dim">(default: ${a.default})</span>` : '';
      html += `<tr><td class="k"><code>${a.optional ? `[${a.name}]` : `&lt;${a.name}&gt;`}</code></td><td>${esc(a.desc)}${def}</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  if (c.options.length) {
    html += `<h2 id="options">Options</h2><div class="table-wrap"><table class="opt"><thead><tr><th>Option</th><th>Description</th></tr></thead><tbody>`;
    for (const o of c.options) {
      const def = o.default ? ` <span class="dim">(default: <code>${o.default}</code>)</span>` : '';
      html += `<tr><td class="k"><code>${o.flag.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></td><td>${esc(o.desc)}${def}</td></tr>`;
    }
    html += `</tbody></table></div>`;
  } else {
    html += `<h2 id="options">Options</h2><p>This command takes no options.</p>`;
  }

  html += `<h2 id="examples">Examples</h2>`;
  for (const ex of c.examples) {
    const copy = ex.cmd.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    html += `<div class="codeblock"><div class="cb-bar"><span class="lbl">${esc(ex.label)}</span><span class="grow"></span>` +
      `<button class="copy sm" data-copy="${copy}">copy</button></div>` +
      `<pre><span class="dim">$</span> ${ex.cmd.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>`;
  }

  if (c.notes) html += `<h2 id="notes">Notes</h2>${c.notes}`;
  return html;
};

// ── cli index ──
write('cli/index.html', subpage({
  title: 'CLI reference — banira.js',
  description: 'Every banira command — scaffold, dev loop, generate artifacts, and release gates.',
  active: 'cli',
  breadcrumb: [{ label: 'banira.js', href: '/' }, { label: 'CLI' }],
  heading: 'CLI reference',
  sub: 'One package, one <code>banira</code> command. Scaffold a component, run the dev loop, generate every artifact, and gate your releases.',
  sidebar: cliSidebar(null),
  body: `<div class="cmd-grid">` + commands.map(c =>
    `<a class="cmd-card" href="/cli/${c.name}/"><div class="name"><span class="b">banira</span> ${c.name}</div><div class="d">${c.summary.replace(/<[^>]+>/g, '')}</div></a>`
  ).join('') + `</div>`,
}));

// ── cli command pages ──
for (const c of commands) {
  write(`cli/${c.name}/index.html`, subpage({
    title: `banira ${c.name} — CLI reference`,
    description: c.summary.replace(/<[^>]+>/g, ''),
    active: 'cli',
    breadcrumb: [{ label: 'banira.js', href: '/' }, { label: 'CLI', href: '/cli/' }, { label: c.name }],
    heading: `banira ${c.name}`,
    sub: null,
    sidebar: cliSidebar(c.name),
    body: cmdBody(c),
  }));
}

// ── playground placeholder (phase 4) ──
write('playground/index.html', subpage({
  title: 'Playground — banira.js',
  description: 'An in-browser banira playground — compile and preview components live. Coming in a later phase.',
  active: '',
  breadcrumb: [{ label: 'banira.js', href: '/' }, { label: 'Playground' }],
  heading: 'Playground',
  sub: 'An in-browser compile-and-preview sandbox.',
  body: `
<div class="callout"><strong>Coming later.</strong> The playground is phase 4 on the roadmap — an in-browser sandbox that
compiles a component and previews it live, no install required. It's marked “maybe” until the earlier phases settle.</div>
<p>In the meantime, the fastest way to try banira is locally — it takes about a minute:</p>
${(await import('./docs.mjs')).code('try it locally', ['npx banira init my-button src', 'npx banira dev src/my-button.ts -o demo/dist -r demo'])}
<p>Or read <a href="/docs/getting-started/">Getting started</a> for the full walk-through.</p>
`,
}));

const pages = 1 + 1 + guides.length + 1 + commands.length + 1;
console.log(`✓ built ${pages} pages → ${out}`);
