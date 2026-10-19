import { createHash } from 'node:crypto';

export type Role = 'research' | 'implementation' | 'review';
export type ModelRef = { providerID: string; id: string };
export type Config = {
  version: 1;
  execution: { maxParallelResearch: number; maxAttempts: number; sessionTimeoutMs: number; checkTimeoutMs: number };
  models: Record<Role, ModelRef[]>;
  checks: Record<string, string[]>;
};
export type Spec = { version: 1; id: string; title: string; requirements: { id: string; text: string }[] };
export type Task = { id: string; title: string; kind: 'research' | 'implementation'; dependencies: string[]; requirements: string[]; acceptance: string[]; checks: string[] };
export type Plan = { version: 1; specID: string; tasks: Task[] };
export type Bundle = { spec: Spec; plan: Plan; config: Config };

export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function keys(o: Record<string, unknown>, allowed: string[], label: string) {
  for (const key of Object.keys(o)) if (!allowed.includes(key)) throw new Error(`${label}: unknown key ${key}`);
}
export function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`${label} must be nonempty text`);
  return value;
}
function id(value: unknown, label: string) {
  const result = string(value, label);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(result)) throw new Error(`${label}: invalid identifier`);
  return result;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}
function strings(value: unknown, label: string) {
  const result = array(value, label).map(v => string(v, label));
  if (new Set(result).size !== result.length) throw new Error(`${label}: duplicate value`);
  return result;
}
function integer(value: unknown, label: string, max: number, min = 1) {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${label} must be ${min}..${max}`);
  return value as number;
}
function version(o: Record<string, unknown>) { if (o.version !== 1) throw new Error('Unsupported schema version; expected 1'); }
export function parseConfig(value: unknown): Config {
  const o = object(value, 'config'); version(o); keys(o, ['version', 'execution', 'models', 'checks'], 'config');
  const e = object(o.execution, 'execution'); keys(e, ['maxParallelResearch', 'maxAttempts', 'sessionTimeoutMs', 'checkTimeoutMs'], 'execution');
  const models = object(o.models, 'models'); keys(models, ['research', 'implementation', 'review'], 'models');
  const parsedModels = {} as Config['models'];
  for (const role of ['research', 'implementation', 'review'] as const) {
    parsedModels[role] = array(models[role], role).map(v => {
      const m = object(v, 'model'); keys(m, ['providerID', 'id'], 'model');
      return { providerID: string(m.providerID, 'providerID'), id: string(m.id, 'model id') };
    });
    if (new Set(parsedModels[role].map(m => JSON.stringify(m))).size !== parsedModels[role].length) throw new Error(`${role}: duplicate model`);
  }
  const checks: Config['checks'] = {};
  for (const [name, argv] of Object.entries(object(o.checks, 'checks'))) {
    id(name, 'check name'); checks[name] = array(argv, `check ${name}`).map(v => string(v, `check ${name}`));
    if (!checks[name]!.length) throw new Error(`check ${name}: empty argv`);
  }
  return { version: 1, execution: {
    maxParallelResearch: integer(e.maxParallelResearch, 'maxParallelResearch', 16),
    maxAttempts: integer(e.maxAttempts, 'maxAttempts', 5),
    sessionTimeoutMs: integer(e.sessionTimeoutMs, 'sessionTimeoutMs', 3_600_000, 100),
    checkTimeoutMs: integer(e.checkTimeoutMs, 'checkTimeoutMs', 600_000, 100),
  }, models: parsedModels, checks };
}
export function parseBundle(specValue: unknown, planValue: unknown, configValue: unknown): Bundle {
  const config = parseConfig(configValue);
  const s = object(specValue, 'spec'); version(s); keys(s, ['version', 'id', 'title', 'requirements'], 'spec');
  const spec: Spec = { version: 1, id: id(s.id, 'spec id'), title: string(s.title, 'title'), requirements: array(s.requirements, 'requirements').map(v => {
    const r = object(v, 'requirement'); keys(r, ['id', 'text'], 'requirement'); return { id: id(r.id, 'requirement id'), text: string(r.text, 'requirement text') };
  }) };
  const requirementIDs = new Set(spec.requirements.map(r => r.id));
  if (!requirementIDs.size || requirementIDs.size !== spec.requirements.length) throw new Error('Requirements empty or duplicated');
  const p = object(planValue, 'plan'); version(p); keys(p, ['version', 'specID', 'tasks'], 'plan');
  if (p.specID !== spec.id) throw new Error('Plan specID mismatch');
  const tasks: Task[] = array(p.tasks, 'tasks').map(v => {
    const t = object(v, 'task'); keys(t, ['id', 'title', 'kind', 'dependencies', 'requirements', 'acceptance', 'checks'], 'task');
    if (t.kind !== 'research' && t.kind !== 'implementation') throw new Error('Invalid task kind');
    const task: Task = { id: id(t.id, 'task id'), title: string(t.title, 'task title'), kind: t.kind, dependencies: strings(t.dependencies, 'dependencies'), requirements: strings(t.requirements, 'task requirements'), acceptance: strings(t.acceptance, 'acceptance'), checks: strings(t.checks, 'checks') };
    if (!task.acceptance.length || !task.requirements.length) throw new Error(`${task.id}: acceptance and requirements required`);
    for (const req of task.requirements) if (!requirementIDs.has(req)) throw new Error(`${task.id}: unknown requirement ${req}`);
    for (const check of task.checks) if (!Object.hasOwn(config.checks, check)) throw new Error(`${task.id}: unknown check ${check}`);
    if (task.kind === 'implementation' && !task.checks.length) throw new Error(`${task.id}: implementation checks required`);
    return task;
  });
  const ids = new Set(tasks.map(t => t.id));
  if (!ids.size || ids.size !== tasks.length) throw new Error('Tasks empty or duplicated');
  for (const t of tasks) for (const dep of t.dependencies) if (!ids.has(dep)) throw new Error(`${t.id}: unknown dependency ${dep}`);
  const visited = new Set<string>(), visiting = new Set<string>();
  function visit(t: Task) {
    if (visiting.has(t.id)) throw new Error(`Dependency cycle at ${t.id}`);
    if (visited.has(t.id)) return;
    visiting.add(t.id); t.dependencies.forEach(d => visit(tasks.find(x => x.id === d)!));
    visiting.delete(t.id); visited.add(t.id);
  }
  tasks.forEach(visit);
  for (const req of requirementIDs) if (!tasks.some(t => t.requirements.includes(req))) throw new Error(`Uncovered requirement ${req}`);
  for (const role of new Set<Role>([...tasks.map(t => t.kind), 'review'])) if (!config.models[role].length) throw new Error(`Configure models.${role} before approval`);
  return { spec, plan: { version: 1, specID: spec.id, tasks }, config };
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => [k, canonical(v)]));
  return value;
}
export function digest(bundle: Bundle): string { return createHash('sha256').update(JSON.stringify(canonical(bundle))).digest('hex'); }
export const defaultConfig: Config = { version: 1, execution: { maxParallelResearch: 4, maxAttempts: 2, sessionTimeoutMs: 600_000, checkTimeoutMs: 120_000 }, models: { research: [], implementation: [], review: [] }, checks: {} };
