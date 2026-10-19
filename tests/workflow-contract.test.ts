import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('CI and tagged-release host smoke use the installed OpenCode executable directly', async () => {
  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  const release = await readFile('.github/workflows/release.yml', 'utf8');
  const dependabot = await readFile('.github/dependabot.yml', 'utf8');

  assert.match(ci, /node scripts\/host-smoke\.mjs "\$prefix\/node_modules\/@opencode\/cli\/bin\/opencode\.exe" "\$PLUGIN_DIR"/);
  assert.match(ci, /Join-Path \$prefix 'node_modules\/@opencode\/cli\/bin\/opencode\.exe'/);
  assert.match(ci, /check \. production-readiness-public-release --target verifying/);
  assert.match(ci, /cron: '17 6 \* \* 1'/);
  assert.match(ci, /npm audit --audit-level=moderate/);
  assert.match(release, /node scripts\/host-smoke\.mjs "\$prefix\/node_modules\/@opencode\/cli\/bin\/opencode\.exe" "\$PLUGIN_DIR"/);
  assert.doesNotMatch(release, /npm run smoke:host/);
  assert.match(release, /check \. production-readiness-public-release --target complete/);
  assert.match(release, /npm audit --omit=dev --audit-level=moderate/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});
