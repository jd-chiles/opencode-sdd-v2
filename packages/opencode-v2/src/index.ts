import { Plugin } from '@opencode/plugin';
import { Engine, ExecutionStopped, digest, type State, type Role } from '../../core/src/index.js';
import { assertApproval, loadBundle } from '../../cli/src/project.js';
import { NativeRunner } from './runner.js';
import { renderStatus } from './status-view.js';

export async function setup(ctx: Plugin.Context): Promise<() => void> {
  const [major, minor, patch] = ctx.app.version.replace(/^v/, '').split('.').map(Number);
  if (major !== 2 || !Number.isInteger(minor) || !Number.isInteger(patch) || (minor === 0 && patch! < 32)) throw new Error('OpenCode SDD requires OpenCode >=2.0.32 and <3 (SDK baseline 2.0.32)');
  const root = ctx.location.directory;
  let busy = false;
  const lifetime = new AbortController();
  async function primary(sessionID: string) {
    if ((await ctx.session.get({ sessionID })).parentID) throw new Error('SDD orchestration is primary-session only; nested delegation denied');
  }
  async function action(name: string, sessionID: string, signal: AbortSignal = lifetime.signal): Promise<unknown> {
    await primary(sessionID);
    if (busy && name !== 'status') throw new Error('An SDD workflow action is already active');
    if (name !== 'status') busy = true;
    try {
      const bundle = await loadBundle(root);
      const fresh = async () => {
        if (signal.aborted || lifetime.signal.aborted) throw new ExecutionStopped('SDD operation cancelled');
        const current = await loadBundle(root);
        if (digest(current) !== digest(bundle)) throw new ExecutionStopped('Artifacts changed during execution');
        await assertApproval(root, current);
      };
      const key = `workflow/${ctx.location.project.id}/${bundle.spec.id}`;
      const runner = new NativeRunner(ctx, bundle, sessionID, AbortSignal.any([signal, lifetime.signal]), fresh);
      const engine = new Engine(bundle, {
        load: async () => (await ctx.storage.get(key)) as unknown as State | undefined,
        save: async state => { await ctx.storage.set(key, JSON.parse(JSON.stringify(state))); },
      }, runner);
      if (name === 'status') return engine.status();
      await fresh();
      if (name === 'preflight') {
        const diagnostics = Object.fromEntries(await Promise.all((['research','implementation','review'] as Role[]).map(async role => [role, await runner.probe(role)])));
        await ctx.storage.set(`${key}/preflight`, JSON.parse(JSON.stringify({ digest: digest(bundle), diagnostics })));
        return { diagnostics, note: 'Text-only child probe; this does not prove provider tool execution or free-tier delegation compatibility.' };
      }
      if (name === 'resume') { await engine.resume(); return engine.run(); }
      if (name === 'refresh-research') return engine.refreshResearch();
      return engine.run(name === 'verify');
    } finally { if (name !== 'status') busy = false; }
  }
  await ctx.command.transform(editor => {
    for (const name of ['specify','plan'] as const) editor.add({
      name: `sdd-${name}`, description: name === 'specify' ? 'Research and write the SDD feature specification' : 'Write a validated SDD task dependency plan',
      execute: async ({ sessionID, prompt, delivery }) => {
        await primary(sessionID);
        if (busy) throw new Error('Workflow active; do not edit approved artifacts during execution');
        await ctx.session.prompt({ sessionID, delivery,
          files: (prompt.files ?? []).map(f => ({ uri: f.uri, ...(f.name === undefined ? {} : { name: f.name }), ...(f.description === undefined ? {} : { description: f.description }) })),
          agents: (prompt.agents ?? []).map(a => ({ name: a.name })),
          skills: (prompt.skills ?? []).map(s => ({ id: s.id })),
          text: [
          `Use the installed sdd-workflow skill. ${name === 'specify' ? 'Research requirements and write .opencode-sdd/spec.json' : 'Read the specification and write .opencode-sdd/plan.json with a dependency DAG'}.`,
          'Follow .opencode-sdd/templates/contracts.md exactly. Keep unknown decisions explicit. Never approve your own artifacts, execute tasks, delegate, publish or alter provider settings. Report the artifact paths for human review and CLI approval.',
          prompt.text,
        ].join('\n\n') });
      },
    });
    for (const name of ['execute','status','verify','resume','refresh-research','preflight']) editor.add({
      name: `sdd-${name}`, description: `SDD ${name}${name === 'preflight' ? ' (explicit live provider probe)' : ''}`,
      execute: async ({ sessionID }) => {
        const result = await action(name, sessionID);
        await ctx.session.synthetic({ sessionID, text: name === 'status' ? renderStatus(result as State) : JSON.stringify(result, null, 2) });
      },
    });
  });
  await ctx.tool.transform(editor => {
    editor.add({ name: 'sdd_status', description: 'Read durable SDD progress and blockers',
      input: { type: 'object', properties: {}, additionalProperties: false },
      execute: async (_input, context) => ({ content: JSON.stringify(await action('status', context.sessionID, context.signal)) }),
    });
    editor.add({ name: 'sdd_run', description: 'Execute, independently verify, or explicitly resume a human-approved SDD workflow. Never approves artifacts.',
      input: { type: 'object', properties: { action: { type: 'string', enum: ['execute','verify','resume','refresh-research'] } }, required: ['action'], additionalProperties: false },
      execute: async (input, context) => {
        const name = (input as { action?: unknown }).action;
        if (typeof name !== 'string' || !['execute','verify','resume','refresh-research'].includes(name)) throw new Error('Invalid SDD action');
        await ctx.permission.assert({ sessionID: context.sessionID, agent: context.agent, action: 'sdd-execute', resources: [name], source: { type: 'tool', messageID: context.messageID, id: context.id } });
        return { content: JSON.stringify(await action(name, context.sessionID, context.signal)) };
      },
    });
  });
  return () => lifetime.abort();
}
export default Plugin.define({ id: 'opencode-sdd', setup });
