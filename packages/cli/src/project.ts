import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { defaultConfig, digest, object, parseBundle, structuralValidationReport, validateBundle, warningCodes, type Bundle, type ValidationReport } from '../../core/src/index.js';

export const artifactDirectory = '.opencode-sdd';
export async function safePath(root: string, name: string): Promise<string> {
  const canonical = await realpath(root), target = resolve(canonical, name), rel = relative(canonical, target);
  if (isAbsolute(rel) || rel.startsWith(`..${sep}`) || rel === '..' || resolve(target) === canonical) throw new Error('Path must be inside project');
  let cursor = canonical;
  for (const part of rel.split(sep)) {
    cursor = join(cursor, part);
    try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error(`Symlink destination refused: ${name}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return target;
}
export async function readJSON(root: string, name: string): Promise<unknown> {
  const path = await safePath(root, name), info = await lstat(path);
  if (!info.isFile() || info.size > 1_000_000) throw new Error(`${name}: expected file smaller than 1MB`);
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { throw new Error(`${name}: invalid JSON`); }
}
export async function loadBundle(root: string): Promise<Bundle> {
  const [spec, plan, config] = await Promise.all(['spec.json','plan.json','config.json'].map(name => readJSON(root, `${artifactDirectory}/${name}`)));
  return parseBundle(spec, plan, config);
}
export async function validate(root: string): Promise<ValidationReport> {
  try { return validateBundle(await loadBundle(root)); }
  catch (error) { return structuralValidationReport(error instanceof Error ? error.message : 'Project validation failed'); }
}
function acknowledgedWarningCodes(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(code => typeof code === 'string')) throw new Error('Approval warning acknowledgement is invalid');
  const codes = [...new Set(value)].sort((left, right) => left.localeCompare(right));
  if (codes.length !== value.length) throw new Error('Approval warning acknowledgement is invalid');
  return codes;
}
export async function assertApproval(root: string, bundle: Bundle): Promise<void> {
  const a = object(await readJSON(root, `${artifactDirectory}/approval.json`), 'approval');
  if (a.digest !== digest(bundle) || a.approved !== true) throw new Error('Approval missing or stale; inspect artifacts and run opencode-sdd approve');
  const expected = warningCodes(validateBundle(bundle));
  if (a.version === 1 && !expected.length) return;
  if (a.version !== 2 || !Array.isArray(a.acknowledgedWarningCodes)) throw new Error('Approval is missing required warning acknowledgement; inspect artifacts and run opencode-sdd approve --accept-warnings');
  const actual = acknowledgedWarningCodes(a.acknowledgedWarningCodes);
  if (actual.length !== expected.length || actual.some((code, index) => code !== expected[index])) throw new Error('Approval warning acknowledgement is stale; inspect artifacts and run opencode-sdd approve --accept-warnings');
}
export async function approve(root: string, options: { acceptWarnings?: boolean } = {}): Promise<string> {
  const bundle = await loadBundle(root), hash = digest(bundle);
  const report = validateBundle(bundle), warnings = warningCodes(report);
  if (warnings.length && !options.acceptWarnings) throw new Error(`Validation warnings require explicit acknowledgement (${warnings.join(', ')}); run opencode-sdd approve --accept-warnings`);
  const file = await safePath(root, `${artifactDirectory}/approval.json`);
  await writeFile(file, JSON.stringify({ version: 2, approved: true, digest: hash, acknowledgedWarningCodes: warnings, at: new Date().toISOString() }, null, 2) + '\n');
  return hash;
}
export async function installFiles(root: string, files: Record<string, string>): Promise<{ created: string[]; preserved: string[] }> {
  const created: string[] = [], preserved: string[] = [];
  // Preflight all conflicts before any writes.
  for (const [name, content] of Object.entries(files)) {
    const target = await safePath(root, name);
    try {
      const current = await readFile(target, 'utf8');
      if (current !== content) throw new Error(`Existing file differs: ${name}; preserve it and install into a clean directory`);
      preserved.push(name);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  for (const [name, content] of Object.entries(files)) {
    if (preserved.includes(name)) continue;
    const target = await safePath(root, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx' }); created.push(name);
  }
  return { created, preserved };
}
export const initialArtifacts = {
  [`${artifactDirectory}/config.json`]: JSON.stringify(defaultConfig, null, 2) + '\n',
  [`${artifactDirectory}/spec.json`]: JSON.stringify({ version: 1, id: 'feature-001', title: 'Describe the requested feature', requirements: [{ id: 'REQ-001', text: 'Replace this text with an observable requirement' }] }, null, 2) + '\n',
  [`${artifactDirectory}/plan.json`]: JSON.stringify({ version: 1, specID: 'feature-001', tasks: [] }, null, 2) + '\n',
};
