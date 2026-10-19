#!/usr/bin/env node
import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { approve, artifactDirectory, assertApproval, initialArtifacts, installFiles, loadBundle, readJSON, safePath, validate } from './project.js';
import { parseConfig } from '../../core/src/index.js';

const packs = fileURLToPath(new URL('../../../../packs/', import.meta.url));
async function packFiles(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(path: string, dest: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(join(path, entry.name), `${dest}/${entry.name}`);
      else if (entry.isFile()) result[`${dest}/${entry.name}`] = await readFile(join(path, entry.name), 'utf8');
    }
  }
  await walk(join(packs, 'agents'), '.opencode/agents');
  await walk(join(packs, 'skills'), '.opencode/skills');
  await walk(join(packs, 'templates'), `${artifactDirectory}/templates`);
  return result;
}
export async function init(root: string) {
  // Project-owned artifacts may change after init; do not overwrite them on repeat runs.
  const files = await packFiles();
  for (const [name, content] of Object.entries(initialArtifacts)) {
    await safePath(root, name);
    try { await readFile(await safePath(root, name)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; files[name] = content; }
  }
  return installFiles(root, files);
}
export async function doctor(root: string): Promise<{ ok: boolean; diagnostics: string[] }> {
  const diagnostics: string[] = [];
  try {
    const config = parseConfig(await readJSON(root, `${artifactDirectory}/config.json`));
    for (const [role, models] of Object.entries(config.models)) if (!models.length) diagnostics.push(`Configure models.${role} with explicit providerID/id choices`);
    for (const name of Object.keys(await packFiles())) await readFile(await safePath(root, name), 'utf8');
    const bundle = await loadBundle(root); await assertApproval(root, bundle);
  } catch (error) { diagnostics.push(error instanceof Error ? error.message : 'Project validation failed'); }
  return { ok: diagnostics.length === 0, diagnostics };
}
export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  const acceptWarnings = rest.includes('--accept-warnings');
  const directories = rest.filter(argument => argument !== '--accept-warnings');
  if (directories.length > 1 || (acceptWarnings && command !== 'approve') || !['init','doctor','validate','approve'].includes(command ?? '')) {
    console.error('Usage: opencode-sdd <init|doctor|validate|approve> [project-directory] [--accept-warnings]'); return 1;
  }
  const directory = directories[0] ?? '.';
  const root = await realpath(resolve(directory));
  if (command === 'init') {
    console.log(JSON.stringify(await init(root), null, 2));
    console.log('Next: add this package directory to plugins in opencode.json(c), configure .opencode-sdd/config.json, write spec/plan, then run approve. No OpenCode settings were changed.');
  } else if (command === 'validate') {
    const report = await validate(root); console.log(JSON.stringify(report, null, 2)); return report.ok ? 0 : 1;
  } else if (command === 'approve') console.log(`Approved spec/plan/config SHA256 ${await approve(root, { acceptWarnings })}`);
  else { const result = await doctor(root); console.log(JSON.stringify(result, null, 2)); return result.ok ? 0 : 1; }
  return 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => { console.error(error instanceof Error ? error.message : 'Command failed'); process.exitCode = 1; });
}
