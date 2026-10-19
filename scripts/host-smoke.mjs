import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Service } from '@opencode/client/service';
import { OpenCode } from '@opencode/client';
import { init } from '../dist/packages/cli/src/index.js';

// Explicit opt-in: supply the actual executable, not a shell wrapper. No provider calls.
const executable = process.argv[2];
assert.ok(executable, 'Usage: npm run smoke:host -- /absolute/path/to/opencode-executable');
const pluginDirectory = resolve(process.argv[3] ?? '.');
const pluginManifest = JSON.parse(await (await import('node:fs/promises')).readFile(join(pluginDirectory, 'package.json'), 'utf8'));
assert.equal(pluginManifest.name, 'opencode-v2-sdd-plugin', 'Host smoke must load the expected plugin package');
const root = await mkdtemp(join(tmpdir(), 'opencode-sdd-host-'));
const registration = join(root, 'XDG_STATE_HOME', 'opencode', 'service.json');
try {
  const project = join(root, 'project'); await mkdir(project); await init(project);
  const env = { ...process.env };
  for (const key of ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME']) {
    env[key] = join(root, key); await mkdir(env[key]);
  }
  env.OPENCODE_CONFIG_DIR = join(env.XDG_CONFIG_HOME, 'opencode'); await mkdir(env.OPENCODE_CONFIG_DIR);
  await writeFile(join(env.OPENCODE_CONFIG_DIR, 'opencode.json'), JSON.stringify({ update: 'disable', plugins: ['*'], policies: [{ action: 'provider.use', resource: '*', effect: 'deny' }] }));
  await writeFile(join(project, 'opencode.json'), JSON.stringify({ plugins: [pluginDirectory], permissions: [{ action: '*', resource: '*', effect: 'deny' }], policies: [{ action: 'provider.use', resource: '*', effect: 'deny' }] }));
  env.OPENCODE_DB = join(root, 'opencode.db');
  const endpoint = await Service.ensure({ file: registration, version: version => version.startsWith('2.'), command: [executable, 'serve', '--service', '--hostname', '127.0.0.1', '--port', '0'], env });
  const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
  const location = { directory: project }, options = {};
  const version = (await client.server.info(options)).version;
  const [major, minor, patch] = version.replace(/^v/, '').split('.').map(Number);
  assert.ok(major === 2 && (minor > 0 || (minor === 0 && patch >= 32)), `Host smoke requires OpenCode >=2.0.32 and <3; received ${version}`);
  await client.location.get({ location }, options);
  const info = await client.server.info(options);
  let commands, agents, skills;
  const deadline = Date.now() + 15_000;
  do {
    const request = { signal: AbortSignal.timeout(3000) };
    [commands, agents, skills] = await Promise.all([client.command.list({ location }, request), client.agent.list({ location }, request), client.skill.list({ location }, request)]);
    if (commands.data.some(c => c.name === 'sdd-specify') && agents.data.some(a => a.id === 'sdd-implementation') && skills.data.some(s => s.id === 'sdd-workflow' || s.name === 'sdd-workflow')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  if (!commands.data.some(c => c.name === 'sdd-specify')) {
    const plugins = await client.plugin.list({ location }, options);
    console.error(JSON.stringify({ version, requested: project, actual: commands.location, commandNames: commands.data.map(c => c.name), agentIDs: agents.data.map(a => a.id), localPlugins: plugins.data.filter(p => p.source.type === 'local' || p.id === 'opencode-sdd') }));
  }
  for (const name of ['specify','plan','execute','status','verify','resume','refresh-research','preflight']) assert.ok(commands.data.some(c => c.name === `sdd-${name}` || c.id === `sdd-${name}`), `Missing command sdd-${name}`);
  for (const role of ['implementation','research','review','orchestrator','architect','planner','security']) assert.ok(agents.data.some(a => a.id === `sdd-${role}`), `Missing agent sdd-${role}`);
  assert.ok(skills.data.some(s => s.id === 'sdd-workflow' || s.name === 'sdd-workflow'));
  console.log(JSON.stringify({ passed: true, serverVersion: info.version, nativeCommands: 8, nativeAgents: 7, skills: 1, modelRequests: 0 }));
} catch (error) {
  console.error(`Host smoke failed: ${error.message}`);
  throw error;
} finally {
  await Service.stop({ file: registration });
  assert.ok(resolve(root).startsWith(resolve(tmpdir())) && root.includes('opencode-sdd-host-'));
  await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
