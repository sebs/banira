// Fails if the shared version numbers of the root, `banira`, and `banira-cli`
// drift apart. These three must always match (see the root `version` script,
// which keeps them in sync during `npm version`). Run locally via `preversion`
// and in CI on every push.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  { label: 'root', path: 'package.json' },
  { label: 'banira', path: 'packages/banira/package.json' },
  { label: 'banira-cli', path: 'packages/banira-cli/package.json' },
];

const versions = targets.map((t) => ({
  ...t,
  version: JSON.parse(readFileSync(join(repoRoot, t.path), 'utf8')).version,
}));

const unique = new Set(versions.map((v) => v.version));

if (unique.size > 1) {
  console.error('Version mismatch — root, banira and banira-cli must share one version:');
  for (const v of versions) console.error(`  ${v.label.padEnd(11)} ${v.version}  (${v.path})`);
  console.error('\nBump the root version with `npm version <patch|minor|major>` to keep them in sync.');
  process.exit(1);
}

const shared = [...unique][0];

// These workspaces pin banira to the exact shared version (kept in lockstep by
// the root `version` script). A drifted pin would resolve the wrong banira — or
// publish a broken dependency — so guard each pin here too.
const dependents = [
  { label: 'banira-cli', path: 'packages/banira-cli/package.json' },
  { label: 'component-my-circle', path: 'packages/component-my-circle/package.json' },
];

for (const d of dependents) {
  const pin = JSON.parse(readFileSync(join(repoRoot, d.path), 'utf8')).dependencies?.banira;
  if (pin !== shared) {
    console.error(`Dependency pin mismatch — ${d.label} depends on banira "${pin}", expected "${shared}".`);
    console.error('Bump the root version with `npm version <patch|minor|major>` to keep the pin in sync.');
    process.exit(1);
  }
}

console.log(`Version check OK — all in sync at ${shared}; banira-cli and component-my-circle pin banira@${shared}.`);
