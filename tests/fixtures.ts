import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { defaultConfig, parseBundle, type Bundle, type Task } from '../packages/core/src/index.js';

export const task = (id = 'TASK-001', kind: Task['kind'] = 'implementation', dependencies: string[] = []): Task => ({ id, title: `Complete ${id}`, kind, dependencies, requirements: ['REQ-001'], acceptance: ['Expected behavior is present'], checks: kind === 'implementation' ? ['test'] : [] });
export function bundle(tasks: Task[] = [task()]): Bundle {
  const model = { providerID: 'fixture', id: 'tool-model' };
  return parseBundle({ version: 1, id: 'feature-001', title: 'Fixture feature', requirements: [{ id: 'REQ-001', text: 'Expected behavior' }] }, { version: 1, specID: 'feature-001', tasks }, { ...defaultConfig, execution: { ...defaultConfig.execution, sessionTimeoutMs: 1000, checkTimeoutMs: 1000 }, models: { research: [model], implementation: [model], review: [model] }, checks: { test: [process.execPath, '-e', 'process.exit(0)'] } });
}
export async function temp(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'opencode-sdd-test-'));
  t.after(async () => {
    if (!resolve(root).startsWith(resolve(tmpdir())) || !root.includes('opencode-sdd-test-')) throw new Error('Unsafe fixture cleanup');
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
export async function writeBundle(root: string, b = bundle()) {
  await mkdir(join(root, '.opencode-sdd'), { recursive: true });
  for (const name of ['spec','plan','config'] as const) await writeFile(join(root, '.opencode-sdd', `${name}.json`), JSON.stringify(b[name]));
}
