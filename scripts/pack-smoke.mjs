import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = await mkdtemp(join(tmpdir(), 'opencode-sdd-pack-'));
function run(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout); return result.stdout;
}
try {
  const packed = JSON.parse(run(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--json', '--pack-destination', root]))[0];
  assert.ok(packed.files.every(file => !file.path.startsWith('dist/tests/')));
  assert.ok(packed.files.every(file => !file.path.startsWith('docs/sdd/') && file.path !== 'docs/production-readiness.md'));
  assert.ok(packed.files.some(file => file.path === 'LICENSE'));
  assert.ok(packed.files.some(file => file.path === 'CHANGELOG.md'));
  run('tar', ['-xzf', join(root, packed.filename), '-C', root]);
  const manifest = JSON.parse(await readFile(join(root, 'package/package.json'), 'utf8'));
  assert.equal(manifest.name, 'opencode-v2-sdd-plugin'); assert.equal(manifest.license, 'MIT');
  const project = join(root, 'fixture'); await mkdir(project);
  const cli = join(root, 'package/dist/packages/cli/src/index.js');
  assert.match(await readFile(join(root, 'package/index.js'), 'utf8'), /export \{ default \}/);
  const result = JSON.parse(run(process.execPath, [cli, 'init', project]).split('\nNext:')[0]);
  assert.equal(result.created.filter(path => path.startsWith('.opencode/agents/')).length, 7);
  assert.match(await readFile(join(root, 'package/dist/packages/cli/src/index.js'), 'utf8'), /^#!\/usr\/bin\/env node/);
  assert.match(await readFile(join(project, '.opencode/agents/sdd-review.md'), 'utf8'), /permissions:/);
  assert.equal(JSON.parse(run(process.execPath, [cli, 'init', project]).split('\nNext:')[0]).created.length, 0);
  console.log(JSON.stringify({ passed: true, package: packed.filename, files: packed.entryCount, packedCliInit: 'passed', repeatInit: 'preserved' }));
} finally {
  assert.ok(resolve(root).startsWith(resolve(tmpdir())) && root.includes('opencode-sdd-pack-'));
  await rm(root, { recursive: true, force: true });
}
