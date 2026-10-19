import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdtemp, mkdir, readFile, rename, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fingerprintWorktree } from '../packages/core/src/index.js';

async function repo(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'sdd-fingerprint-'));
  t.after(async () => { const { rm } = await import('node:fs/promises'); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'SDD Test'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'sdd-test@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
  await writeFile(join(root, 'tracked.txt'), 'base\n');
  execFileSync('git', ['add', 'tracked.txt'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'base'], { cwd: root });
  return root;
}

test('same-length edits to an already-dirty tracked file always change the digest', async t => {
  const root = await repo(t), file = join(root, 'tracked.txt');
  await writeFile(file, 'edit\n'); const first = await fingerprintWorktree(root);
  await writeFile(file, 'next\n'); const second = await fingerprintWorktree(root);
  await writeFile(file, 'last\n'); const third = await fingerprintWorktree(root);
  assert.notEqual(first, second); assert.notEqual(second, third); assert.equal(first.length, 64);
});

test('staged content edited again is fingerprinted from the worktree bytes', async t => {
  const root = await repo(t), file = join(root, 'tracked.txt');
  await writeFile(file, 'stage\n'); execFileSync('git', ['add', 'tracked.txt'], { cwd: root });
  const staged = await fingerprintWorktree(root);
  await writeFile(file, 'later\n');
  assert.notEqual(staged, await fingerprintWorktree(root));
});

test('nested non-ignored untracked files and their content are included', async t => {
  const root = await repo(t), directory = join(root, 'new', 'nested');
  const initial = await fingerprintWorktree(root); await mkdir(directory, { recursive: true });
  const file = join(directory, 'note.txt'); await writeFile(file, 'one\n'); const first = await fingerprintWorktree(root);
  await writeFile(file, 'two\n'); const second = await fingerprintWorktree(root);
  assert.notEqual(initial, first); assert.notEqual(first, second);
});

test('ignored files are excluded while Git paths with spaces, Unicode, and newlines are safe', async t => {
  const root = await repo(t), ignored = join(root, 'ignored.log');
  await writeFile(join(root, '.gitignore'), 'ignored.log\n'); await writeFile(ignored, 'ignored bytes');
  const before = await fingerprintWorktree(root);
  await writeFile(ignored, 'different ignored bytes');
  assert.equal(await fingerprintWorktree(root), before);
  const unusualName = process.platform === 'win32' ? 'space name-雪.txt' : 'space name-雪\nline.txt';
  await writeFile(join(root, unusualName), 'included');
  assert.notEqual(await fingerprintWorktree(root), before);
});

test('deletions and renames change the digest', async t => {
  const root = await repo(t), file = join(root, 'tracked.txt'), original = await fingerprintWorktree(root);
  await unlink(file); const deleted = await fingerprintWorktree(root); assert.notEqual(original, deleted);
  await writeFile(join(root, 'renamed.txt'), 'base\n'); const renamed = await fingerprintWorktree(root);
  assert.notEqual(deleted, renamed); assert.notEqual(original, renamed);
});

test('staged deletion stays represented after the path leaves the index', async t => {
  const root = await repo(t), file = join(root, 'tracked.txt'), original = await fingerprintWorktree(root);
  await unlink(file); execFileSync('git', ['add', '-u'], { cwd: root });
  assert.notEqual(original, await fingerprintWorktree(root));
});

test('executable-mode changes alter the worktree fingerprint where the platform preserves them', async t => {
  const root = await repo(t), file = join(root, 'tracked.txt');
  await chmod(file, 0o644);
  const beforeMode = (await lstat(file)).mode & 0o111;
  const before = await fingerprintWorktree(root);
  await chmod(file, 0o755);
  const afterMode = (await lstat(file)).mode & 0o111;
  if (beforeMode === afterMode) { t.skip('Executable permission bits are not mutable on this runner'); return; }
  assert.notEqual(before, await fingerprintWorktree(root));
});

test('symlink target bytes are included when the platform allows symlink creation', async t => {
  const root = await repo(t), link = join(root, 'link');
  try { await symlink('target-one', link); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code ?? '')) { t.skip('Symlink creation is unavailable on this runner'); return; }
    throw error;
  }
  const first = await fingerprintWorktree(root); await unlink(link); await symlink('target-two', link);
  assert.notEqual(first, await fingerprintWorktree(root));
});

test('repeated calls are stable and committing unchanged worktree content preserves the digest', async t => {
  const root = await repo(t), file = join(root, 'tracked.txt');
  await writeFile(file, 'edited\n'); const before = await fingerprintWorktree(root);
  assert.equal(await fingerprintWorktree(root), before);
  execFileSync('git', ['add', 'tracked.txt'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'same worktree'], { cwd: root });
  assert.equal(await fingerprintWorktree(root), before);
  assert.equal(await readFile(file, 'utf8'), 'edited\n');
});

test('fingerprinting requires Git enumeration and fails closed outside a repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'sdd-not-git-'));
  t.after(async () => { const { rm } = await import('node:fs/promises'); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  await assert.rejects(fingerprintWorktree(root));
});
