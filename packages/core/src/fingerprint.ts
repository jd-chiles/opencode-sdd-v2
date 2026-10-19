import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile, readlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve, sep } from 'node:path';

const execFileAsync = promisify(execFile);

function decodePaths(bytes: Buffer): string[] {
  const paths: string[] = [];
  let start = 0;
  for (let end = 0; end < bytes.length; end++) if (bytes[end] === 0) {
    const raw = bytes.subarray(start, end), decoded = raw.toString('utf8');
    if (!Buffer.from(decoded, 'utf8').equals(raw)) throw new Error('Git returned a path that is not valid UTF-8');
    paths.push(decoded); start = end + 1;
  }
  if (start !== bytes.length) throw new Error('Git returned a malformed NUL-delimited path list');
  return paths;
}

function frame(hash: ReturnType<typeof createHash>, value: Buffer | string): void {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  hash.update(length).update(bytes);
}

/**
 * Fingerprint the current Git worktree content, independent of commit/index identity.
 * Tracked deletions are explicit; ignored files and .git metadata are excluded.
 * Submodules and special filesystem nodes fail closed rather than receiving an
 * ambiguous fingerprint.
 */
export async function fingerprintWorktree(root: string): Promise<string> {
  const options = {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  } as const;
  const [indexAndUntracked, committed] = await Promise.all([
    execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], options),
    execFileAsync('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD'], options),
  ]);
  const names = new Set([
    ...decodePaths(indexAndUntracked.stdout as Buffer),
    ...decodePaths(committed.stdout as Buffer),
  ]);
  const orderedNames = [...names];
  orderedNames.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  const hash = createHash('sha256');
  frame(hash, 'opencode-sdd-worktree-v1');
  const rootPath = resolve(root);
  for (const name of orderedNames) {
    const normalized = name.split('/').join(sep);
    const absolute = resolve(rootPath, normalized);
    if (absolute !== rootPath && !absolute.startsWith(rootPath + sep)) throw new Error('Git returned a path outside the worktree');
    frame(hash, name);
    let before;
    try { before = await lstat(absolute); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      frame(hash, 'absent');
      continue;
    }
    if (before.isSymbolicLink()) {
      const target = await readlink(absolute, { encoding: 'buffer' });
      const after = await lstat(absolute);
      if (before.dev !== after.dev || before.ino !== after.ino || before.ctimeMs !== after.ctimeMs) throw new Error(`Worktree changed while fingerprinting ${name}`);
      frame(hash, `symlink:${before.mode & 0o777}`);
      frame(hash, target);
    } else if (before.isFile()) {
      const content = await readFile(absolute);
      const after = await lstat(absolute);
      if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error(`Worktree changed while fingerprinting ${name}`);
      frame(hash, `file:${before.mode & 0o111 ? 1 : 0}`);
      frame(hash, content);
    } else {
      throw new Error(`Unsupported worktree entry while fingerprinting ${name}`);
    }
  }
  return hash.digest('hex');
}
