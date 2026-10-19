import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from '@opencode/plugin';
import type { CommandDefinition } from '@opencode/plugin/promise/command';
import type { Info as ToolInfo, ToolContext } from '@opencode/plugin/promise/tool';
import { Engine, digest, type State, type TaskState } from '../packages/core/src/index.js';
import { fingerprintWorktree } from '../packages/core/src/fingerprint.js';
import { setup } from '../packages/opencode-v2/src/index.js';
import { boundPriorEvidence, MAX_PRIOR_EVIDENCE_CHARS, NativeRunner } from '../packages/opencode-v2/src/runner.js';
import { renderStatus } from '../packages/opencode-v2/src/status-view.js';
import { runCheck } from '../packages/opencode-v2/src/checks.js';
import { approve } from '../packages/cli/src/project.js';
import { init } from '../packages/cli/src/index.js';
import { bundle, task, temp, writeBundle } from './fixtures.js';

async function fake(t: Parameters<typeof temp>[0]) {
  const root=await temp(t), worktree=join(root,'worktree'); await mkdir(worktree);
  await writeFile(join(worktree,'seed.txt'),'seed\n');
  execFileSync('git',['init','--quiet'],{cwd:worktree});
  execFileSync('git',['config','user.name','SDD Test'],{cwd:worktree});
  execFileSync('git',['config','user.email','sdd-test@example.invalid'],{cwd:worktree});
  execFileSync('git',['config','core.autocrlf','false'],{cwd:worktree});
  execFileSync('git',['add','seed.txt'],{cwd:worktree});
  execFileSync('git',['commit','--quiet','-m','fixture'],{cwd:worktree});
  const b=bundle(); await init(root); await writeBundle(root,b); await approve(root);
  const commands=new Map<string,CommandDefinition>(),tools=new Map<string,ToolInfo>();
  const storage=new Map<string,unknown>();
  const sessions=new Map<string,{ agent:string; permissions:unknown[]; parentID?:string; location?:{directory:string}; model?:unknown }>();
  const calls:{ method:string; input:unknown }[]=[];
  let reviewPass=true,probe=false,throwPrompt=false,active=false,denyPermissions=false;
  const ctx={
    app:{version:'2.0.32'},
    location:{ directory:root,project:{id:'project-1',directory:root,canonical:root} },
    command:{transform:async(fn:(e:unknown)=>void)=>{fn({add:(c:CommandDefinition)=>commands.set(c.name,c)});}},
    tool:{transform:async(fn:(e:unknown)=>void)=>{fn({add:(v:ToolInfo)=>tools.set(v.name,v)});}},
    storage:{get:async(key:string)=>structuredClone(storage.get(key)),set:async(key:string,value:unknown)=>{storage.set(key,structuredClone(value));}},
    model:{list:async()=>({data:[{id:'tool-model',providerID:'fixture',enabled:true,capabilities:{tools:true}}]})},
    agent:{list:async()=>({data:['implementation','research','review'].map(role=>({id:`sdd-${role}`}))})},
    permission:{assert:async(input:unknown)=>{calls.push({method:'permission',input}); if(denyPermissions)throw new Error('denied');}},
    worktree:{create:async(input:unknown)=>{calls.push({method:'worktree',input}); return {directory:worktree};}},
    session:{
      get:async({sessionID}:{sessionID:string})=>({ id:sessionID, ...(sessions.get(sessionID)?.parentID ? {parentID:sessions.get(sessionID)!.parentID}:{}), permissions:[{action:'shell',resource:'forbidden',effect:'deny'}],time:active&&sessionID!=='parent'?{updated:2}:{updated:1,idle:2},outcome:'succeeded' }),
      create:async(input:{agent:string; permissions:unknown[]; parentID?:string})=>{const id=`native-${sessions.size+1}`; sessions.set(id,input); calls.push({method:'create',input});return {id};},
      prompt:async(input:{sessionID:string;text:string})=>{calls.push({method:'prompt',input}); if(input.text.includes('SDD_OK'))probe=true; if(throwPrompt)throw new Error('provider failure with secret-like text');},
      wait:async(input:unknown)=>{calls.push({method:'wait',input});},
      context:async({sessionID}:{sessionID:string})=>[{type:'assistant',finish:'stop',time:{completed:1},content:[{type:'text',text:probe?'SDD_OK':sessions.get(sessionID)?.agent==='sdd-review'?JSON.stringify({criteria:[{criterion:'Expected behavior is present',passed:reviewPass,evidence:'Read implementation fixture'}]}):'Worker result'}]}],
      interrupt:async(input:unknown)=>{calls.push({method:'interrupt',input});},
      synthetic:async(input:unknown)=>{calls.push({method:'synthetic',input});},
    },
  } as unknown as Plugin.Context;
  return {ctx,root,worktree,b,commands,tools,storage,sessions,calls,set reviewPass(v:boolean){reviewPass=v;},set throwPrompt(v:boolean){throwPrompt=v;},set active(v:boolean){active=v;},set denyPermissions(v:boolean){denyPermissions=v;}};
}
test('native adapter checkpoints session before prompt, asserts permission, isolates and verifies', async t => {
  const f=await fake(t); let saved:State|undefined;
  const runner=new NativeRunner(f.ctx,f.b,'parent',new AbortController().signal,async()=>{});
  const engine=new Engine(f.b,{load:async()=>saved,save:async s=>{saved=structuredClone(s);}},runner);
  const originalPrompt=f.ctx.session.prompt;
  f.ctx.session.prompt=async(...args)=>{assert.ok(Object.values(saved!.tasks).some(s=>s.sessions.includes(args[0].sessionID)));return originalPrompt(...args);};
  const result=await engine.run(); const s=result.tasks['TASK-001']!;
  assert.equal(s.phase,'verified'); assert.equal(s.checks[0]!.passed,true); assert.equal(s.review!.passed,true);
  assert.equal(s.sessions.length,2); assert.equal(result.directory,f.worktree);
  assert.ok(f.calls.some(c=>c.method==='worktree'));
  const worker=[...f.sessions.values()][0]!;
  assert.equal(worker.location!.directory,f.worktree); assert.equal(worker.parentID,'parent');
  assert.deepEqual(worker.model,{providerID:'fixture',id:'tool-model'});
  assert.ok(worker.permissions.some(p=>(p as {action:string;effect:string}).action==='subagent'&&(p as {effect:string}).effect==='deny'));
  assert.ok(worker.permissions.some(p=>(p as {resource:string}).resource==='forbidden'));
  const review=[...f.sessions.values()][1]!;
  assert.ok(review.permissions.some(p=>(p as {action:string}).action==='shell'));
  assert.ok(f.calls.some(c=>c.method==='permission'&&(c.input as {action:string}).action==='subagent'));
  assert.ok(f.calls.some(c=>c.method==='permission'&&(c.input as {action:string}).action==='shell'));
  const shellCall=f.calls.find(c=>c.method==='permission'&&(c.input as {action:string}).action==='shell')!;
  assert.ok((shellCall.input as {resources:string[]}).resources.includes(f.b.config.checks.test!.join(' ')));
  assert.match(await readFile(join(f.worktree,'.opencode/agents/sdd-review.md'),'utf8'), /permissions:/);
});
test('real local checks pass/fail/timeout, reject missing executable and do not invoke a shell', async t => {
  const root=await temp(t);
  assert.equal((await runCheck('pass',[process.execPath,'-e','process.exit(0)'],root,1000)).passed,true);
  assert.equal((await runCheck('fail',[process.execPath,'-e','process.exit(3)'],root,1000)).exitCode,3);
  const timeout=await runCheck('timeout',[process.execPath,'-e','setInterval(()=>{},1000)'],root,100);
  assert.equal(timeout.passed,false); assert.equal(timeout.timedOut,true);
  assert.equal((await runCheck('missing',['opencode-sdd-no-such-executable'],root,1000)).passed,false);
  assert.equal((await runCheck('literal',[process.execPath,'-e','process.exit(process.argv[1] === "$(echo dangerous)" ? 0 : 1)','$(echo dangerous)'],root,1000)).passed,true);
  const abort=new AbortController(); abort.abort(); assert.equal((await runCheck('abort',[process.execPath],root,1000,abort.signal)).passed,false);
});
test('review rejection or failed executable blocks task success', async t => {
  const f=await fake(t); f.reviewPass=false;
  const runner=new NativeRunner(f.ctx,f.b,'parent',new AbortController().signal,async()=>{});
  const s:TaskState={phase:'review',attempts:1,sessions:[],checks:[]};
  await assert.rejects(runner.verify(task(),s,f.worktree,async()=>{}), /review did not pass/);
  assert.equal(s.review!.passed,false);
  f.b.config.checks.test=[process.execPath,'-e','process.exit(4)'];
  await assert.rejects(runner.verify(task(),s,f.worktree,async()=>{}),/check failed/); assert.equal(s.checks[0]!.exitCode,4);
});
test('a successful check that mutates the worktree is rejected before review', async t => {
  const f=await fake(t), runner=new NativeRunner(f.ctx,f.b,'parent',new AbortController().signal,async()=>{});
  f.b.config.checks.test=[process.execPath,'-e',"require('node:fs').writeFileSync('seed.txt','changed\\n')"];
  const state:TaskState={phase:'review',attempts:1,sessions:[],checks:[]};
  await assert.rejects(runner.verify(task(),state,f.worktree,async()=>{}),/Worktree changed during check/);
  assert.equal(state.checks[0]!.passed,true); assert.equal(f.sessions.size,0);
});
test('unavailable models and host denials prevent native dispatch', async t => {
  const f=await fake(t); f.b.config.models.implementation=[{providerID:'unauthorized',id:'missing'}];
  let runner=new NativeRunner(f.ctx,f.b,'parent',new AbortController().signal,async()=>{});
  await assert.rejects(runner.available('implementation'), /No enabled tool-capable model/); assert.equal(f.sessions.size,0);
  f.denyPermissions=true;
  runner=new NativeRunner(f.ctx,bundle(),'parent',new AbortController().signal,async()=>{});
  await assert.rejects(runner.work(task(),{phase:'running',attempts:1,sessions:[],checks:[]},f.worktree,async()=>{}),/denied/);
  assert.equal(f.sessions.size,0);
});
test('provider failure records native ID, interrupts safely and avoids raw exception persistence', async t => {
  const f=await fake(t); f.throwPrompt=true; f.active=true; let saved:State|undefined;
  const runner=new NativeRunner(f.ctx,f.b,'parent',new AbortController().signal,async()=>{});
  const engine=new Engine(f.b,{load:async()=>saved,save:async s=>{saved=structuredClone(s);}},runner);
  const state=await engine.run(); assert.equal(state.tasks['TASK-001']!.phase,'blocked'); assert.equal(f.sessions.size,1);
  assert.ok(f.calls.some(c=>c.method==='interrupt'&&(c.input as {resume:boolean}).resume===false));
  assert.doesNotMatch(JSON.stringify(state),/secret-like/);
});
test('explicit fallback uses only the next configured available model', async t => {
  const f=await fake(t); f.b.config.models.implementation.push({providerID:'fixture',id:'alternative'});
  f.ctx.model.list=async()=>({data:[{id:'tool-model',providerID:'fixture',enabled:true,capabilities:{tools:true}},{id:'alternative',providerID:'fixture',enabled:true,capabilities:{tools:true}}]} as unknown as Awaited<ReturnType<Plugin.Context['model']['list']>>);
  const runner=new NativeRunner(f.ctx,f.b,'parent',new AbortController().signal,async()=>{});
  await runner.work(task(),{phase:'running',attempts:2,sessions:[],checks:[]},f.worktree,async()=>{});
  assert.deepEqual([...f.sessions.values()][0]!.model,{providerID:'fixture',id:'alternative'});
});
test('prior-session evidence has one deterministic 20000-character budget and marks truncation', () => {
  const dependency={taskID:'DEP',sessionID:'dep-session',text:'d'.repeat(15_000),priority:1,taskOrder:0,sessionOrder:0};
  const current={taskID:'TASK',sessionID:'current-failure',text:'f'.repeat(10_000),priority:0,taskOrder:0,sessionOrder:0};
  const first=boundPriorEvidence([dependency,current]), reversed=boundPriorEvidence([current,dependency]);
  assert.deepEqual(first,reversed); assert.equal(first.characterCount,MAX_PRIOR_EVIDENCE_CHARS); assert.equal(first.truncated,true);
  assert.equal(first.entries[0]!.sessionID,'current-failure'); assert.equal(first.entries[0]!.text.length,10_000);
  assert.equal(first.entries[1]!.sessionID,'dep-session'); assert.equal(first.entries[1]!.text.length,10_000);
  assert.ok(first.entries.every(entry=>!entry.text.includes('stdout')&&!entry.text.includes('stderr')));
});
test('worker prompt keeps the contract separate and sends only the bounded evidence packet', async t => {
  const f=await fake(t), runner=new NativeRunner(f.ctx,f.b,'parent',new AbortController().signal,async()=>{});
  const state={version:3 as const,digest:digest(f.b),directory:f.worktree,tasks:{
    A:{phase:'verified' as const,attempts:1,sessions:['dependency-session'],checks:[],attemptHistory:[]},
    B:{phase:'pending' as const,attempts:2,sessions:['current-failure-session'],checks:[{name:'test',passed:false,exitCode:1,timedOut:false}],attemptHistory:[{attempt:1,mode:'builder' as const,failure:'check-failed' as const,checkName:'test',exitCode:1,timedOut:false}]},
  }};
  f.ctx.session.context=async ({sessionID})=>[{type:'assistant',finish:'stop',time:{completed:1},content:[{type:'text',text:sessionID==='current-failure-session'?'C'.repeat(13_000):sessionID==='dependency-session'?'D'.repeat(13_000):'Worker result'}]}] as never;
  await runner.prepare(state,async()=>{});
  await runner.work({...task('B'),dependencies:['A']},state.tasks.B as TaskState,f.worktree,async()=>{});
  const prompt=(f.calls.filter(call=>call.method==='prompt').at(-1)!.input as {text:string}).text;
  const match=prompt.match(/Prior-session evidence packet \(\d+\/20000 characters; truncated=(true|false)\):\n([\s\S]*?)\nReturn a concise result/);
  assert.ok(match); const entries=JSON.parse(match[2]!) as {taskID:string;sessionID:string;text:string}[];
  assert.equal(entries.reduce((sum,entry)=>sum+entry.text.length,0),20_000);
  assert.equal(entries[0]!.taskID,'B'); assert.equal(entries[0]!.text.length,13_000);
  assert.equal(entries[1]!.taskID,'A'); assert.equal(entries[1]!.text.length,7_000);
  assert.equal(match[1],'true'); assert.ok(prompt.indexOf('Approved contract')<prompt.indexOf('Prior-session evidence packet'));
  assert.doesNotMatch(prompt,/stdout|stderr/);
});
test('all native commands/tools register, execute/status/reverify survive reload, and child commands are denied', async t => {
  const f=await fake(t); const cleanup=await setup(f.ctx);
  assert.deepEqual([...f.commands.keys()].sort(),['execute','plan','preflight','refresh-research','resume','specify','status','verify'].map(n=>`sdd-${n}`).sort());
  assert.deepEqual([...f.tools.keys()].sort(),['sdd_run','sdd_status']);
  const invoke=async(name:string,text='')=>f.commands.get(name)!.execute({sessionID:'parent',prompt:{text},delivery:'queue'} as Parameters<CommandDefinition['execute']>[0]);
  await invoke('sdd-specify','Requested behavior'); await invoke('sdd-plan');
  assert.ok(f.calls.some(c=>c.method==='prompt'&&(c.input as {text:string}).text.includes('Requested behavior')));
  await invoke('sdd-execute'); assert.equal(f.sessions.size,2);
  await invoke('sdd-status'); await invoke('sdd-refresh-research');
  await f.tools.get('sdd_run')!.execute({action:'refresh-research'}, {sessionID:'parent'} as ToolContext);
  assert.equal(f.sessions.size,2); await invoke('sdd-verify'); assert.equal(f.sessions.size,3);
  cleanup(); const cleanup2=await setup(f.ctx); await invoke('sdd-status'); assert.equal(f.sessions.size,3);
  const state=[...f.storage.values()][0] as State; assert.equal(state.tasks['TASK-001']!.phase,'verified');
  const child=[...f.sessions.keys()][0]!;
  await assert.rejects(f.commands.get('sdd-status')!.execute({sessionID:child,prompt:{text:''},delivery:'queue'} as Parameters<CommandDefinition['execute']>[0]), /primary-session only/);
  cleanup2();
});
test('stale approval prevents command execution and probes report their limited scope', async t => {
  const f=await fake(t); await setup(f.ctx);
  const input={sessionID:'parent',prompt:{text:''},delivery:'queue'} as Parameters<CommandDefinition['execute']>[0];
  await f.commands.get('sdd-preflight')!.execute(input);
  assert.equal(f.sessions.size,3);
  assert.ok([...f.storage.keys()].some(k=>k.endsWith('/preflight')));
  assert.ok(f.calls.some(c=>c.method==='synthetic'&&(c.input as {text:string}).text.includes('does not prove')));
  f.b.spec.title='Changed'; await writeBundle(f.root,f.b);
  await assert.rejects(f.commands.get('sdd-execute')!.execute(input),/stale/);
  assert.equal(f.sessions.size,3);
});
test('deterministic tool input rejects unknown actions', async t => {
  const f=await fake(t); await setup(f.ctx);
  await assert.rejects(f.tools.get('sdd_run')!.execute({action:'approve'}, {sessionID:'parent'} as ToolContext), /Invalid/);
});
test('human status summarizes current, stale, blocked, and in-progress workflows while the tool remains JSON', async t => {
  const render = async (state: State) => {
    const f=await fake(t); await setup(f.ctx);
    f.storage.set(`workflow/project-1/${f.b.spec.id}`,state);
    const command=f.commands.get('sdd-status')!;
    await command.execute({sessionID:'parent',prompt:{text:''},delivery:'queue'} as Parameters<CommandDefinition['execute']>[0]);
    const text=(f.calls.filter(c=>c.method==='synthetic').at(-1)!.input as {text:string}).text;
    const tool=f.tools.get('sdd_status')!;
    const toolResult=await tool.execute({}, {sessionID:'parent'} as ToolContext) as {content:string};
    return {text, json:JSON.parse(toolResult.content) as State};
  };
  const f=await fake(t), fingerprint=await fingerprintWorktree(f.worktree), verified:TaskState={phase:'verified',attempts:1,sessions:['review-1'],checks:[],attemptHistory:[],verification:{fingerprint,verifiedAt:'2026-10-19T00:00:00.000Z'}};
  const current:State={version:3,digest:digest(f.b),directory:f.worktree,executionFingerprint:fingerprint,tasks:{'TASK-001':{...verified,attemptHistory:[]}},finalVerification:{fingerprint,taskIDs:['TASK-001'],verifiedAt:'2026-10-19T00:00:00.000Z'}};
  const currentResult=await render(current);
  assert.match(currentResult.text,/Progress: 1\/1 tasks verified/); assert.match(currentResult.text,/Evidence freshness: current/); assert.match(currentResult.text,/Suggested next command: \/sdd-status/);
  assert.equal(currentResult.json.currentVerification!.current,true); assert.equal(currentResult.json.tasks['TASK-001']!.phase,'verified');

  const staleResult=await render({...current, finalVerification:{...current.finalVerification!,fingerprint:'a'.repeat(64)}, tasks:{'TASK-001':{...verified,verification:{...verified.verification!,fingerprint:'a'.repeat(64)}}}});
  assert.match(staleResult.text,/Evidence freshness: stale/); assert.match(staleResult.text,/Suggested next command: \/sdd-verify/);

  const blockedResult=await render({version:3,digest:digest(f.b),tasks:{'TASK-001':{phase:'blocked',attempts:1,sessions:['worker-1'],checks:[],attemptHistory:[],error:'Session may still be active; inspect before sdd-resume'}}});
  assert.match(blockedResult.text,/Blockers:/); assert.match(blockedResult.text,/TASK-001: Session may still be active/); assert.match(blockedResult.text,/Suggested next command: \/sdd-resume/);

  const inProgress=renderStatus({version:3,digest:digest(f.b),tasks:{'TASK-001':{phase:'review',attempts:1,sessions:['review-1'],checks:[],attemptHistory:[]}}});
  assert.match(inProgress,/1 in progress/); assert.match(inProgress,/Evidence freshness: not yet verified/); assert.match(inProgress,/Suggested next command: \/sdd-status/);

  const staleResearch=renderStatus({version:3,digest:digest(f.b),historicalResearchTaskIDs:['TASK-001'],tasks:{'TASK-001':{phase:'verified',attempts:1,sessions:['research-1'],checks:[],attemptHistory:[],researchInputFingerprint:'a'.repeat(64)}}});
  assert.match(staleResearch,/Evidence freshness: stale; research inputs changed or lack provenance/);
  assert.match(staleResearch,/Suggested next command: \/sdd-refresh-research/);
});
test('unsupported early v2 hosts fail clearly before registering commands', async t => {
  const f=await fake(t);
  const older={...f.ctx,app:{...f.ctx.app,version:'2.0.30'}} as Plugin.Context;
  await assert.rejects(setup(older),/requires OpenCode >=2.0.32/); assert.equal(f.commands.size,0);
});
