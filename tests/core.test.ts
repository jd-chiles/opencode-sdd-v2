import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, ExecutionStopped, ReviewRetryableError, digest, parseBundle, parseConfig, type Runner, type State, type Store, type TaskState } from '../packages/core/src/index.js';
import { bundle, task } from './fixtures.js';

function fixture(b = bundle()) {
  let saved: State | undefined;
  const store: Store = { load: async () => structuredClone(saved), save: async s => { saved = structuredClone(s); } };
  const events: string[] = [];
  let treeFingerprint = 'a'.repeat(64);
  let mutateDuringVerify = false;
  const runner: Runner = {
    prepare: async s => { s.directory ??= 'fixture-worktree'; },
    work: async (t, s, _d, checkpoint) => { s.sessions.push(`session-${t.id}-${s.attempts}`); await checkpoint(); events.push(t.id); return 'observed work'; },
    verify: async (_t, s) => { s.review = { sessionID: 'review', passed: true, criteria: [{ criterion: 'Expected behavior is present', passed: true, evidence: 'fixture' }] }; if (mutateDuringVerify) treeFingerprint = 'b'.repeat(64); },
    review: async (_t, s) => { s.review = { sessionID: 'review-retry', passed: true, criteria: [{ criterion: 'Expected behavior is present', passed: true, evidence: 'fixture' }] }; },
    fingerprint: async () => treeFingerprint,
    idle: async () => true,
  };
  return { store, runner, events, engine: new Engine(b, store, runner), get saved() { return saved!; }, set saved(value: State) { saved = value; }, set treeFingerprint(value: string) { treeFingerprint = value; }, set mutateDuringVerify(value: boolean) { mutateDuringVerify = value; } };
}
test('contracts reject cycles, missing dependencies, duplicate IDs, uncovered requirements and missing checks', () => {
  const b = bundle();
  for (const tasks of [
    [task('A','research',['B']), task('B','research',['A'])], [task('A','research',['missing'])], [task('A'), task('A')],
    [{ ...task(), acceptance: [] }], [{ ...task(), requirements: ['unknown'] }], [{ ...task(), checks: [] }], [{ ...task(), checks: ['unknown'] }],
  ]) assert.throws(() => parseBundle(b.spec, { ...b.plan, tasks }, b.config));
  assert.throws(() => parseBundle({ ...b.spec, requirements: [...b.spec.requirements, { id:'REQ-002',text:'Uncovered' }] }, b.plan, b.config), /Uncovered/);
  assert.throws(() => parseBundle({ ...b.spec, requirements: [...b.spec.requirements, ...b.spec.requirements] }, b.plan, b.config), /duplicated/);
});
test('configuration rejects unknown fields, bad limits and missing model roles', () => {
  const b = bundle();
  assert.throws(() => parseConfig({ ...b.config, typo: true }), /unknown key/);
  for (const limit of [0,17,1.2]) assert.throws(() => parseConfig({ ...b.config, execution: { ...b.config.execution, maxParallelResearch: limit } }));
  assert.throws(() => parseBundle(b.spec, b.plan, { ...b.config, models: { ...b.config.models, review: [] } }), /models.review/);
  assert.throws(() => parseConfig({ ...b.config, checks: { test: [] } }), /empty argv/);
  assert.doesNotThrow(() => parseConfig({ ...b.config, checks: { test: ['echo','same','same'] } }));
});
test('approval digest is stable for object order and changes for every input baseline', () => {
  const b = bundle();
  assert.equal(digest(b), digest({ config:b.config, plan:b.plan, spec:b.spec }));
  for (const changed of [{ ...b,spec:{...b.spec,title:'Changed'} },{ ...b,plan:{...b.plan,tasks:[{...b.plan.tasks[0]!,title:'Changed'}]} }, { ...b,config:{...b.config,checks:{test:['false']}} }]) assert.notEqual(digest(b), digest(changed));
});
test('DAG unlocks dependent tasks only after verified work and persists evidence', async () => {
  const f = fixture(bundle([task('A','research'),task('B','implementation',['A'])]));
  const state = await f.engine.run();
  assert.deepEqual(f.events, ['A','B']);
  assert.ok(Object.values(state.tasks).every(s => s.phase === 'verified' && s.attempts === 1 && s.review?.passed));
  assert.match(state.tasks.A!.researchInputFingerprint!,/^[0-9a-f]{64}$/);
  assert.deepEqual((await new Engine(f.engine.bundle,f.store,f.runner).status()), state);
});
test('research bounded and builders serialized, with real overlapping promises', async () => {
  const b = bundle([task('R1','research'),task('R2','research'),task('R3','research'),task('B1'),task('B2')]);
  b.config.execution.maxParallelResearch = 2;
  const f = fixture(b); let research=0,builders=0,maxResearch=0,maxBuilders=0,completedResearch=0;
  f.runner.work = async t => {
    f.events.push(t.id);
    if(t.kind==='implementation') assert.equal(completedResearch,3,'builders must wait for all ready research verification to finish');
    if (t.kind==='research') maxResearch=Math.max(maxResearch,++research); else maxBuilders=Math.max(maxBuilders,++builders);
    await new Promise(resolve => setTimeout(resolve,10));
    if (t.kind==='research') research--; else builders--; return 'done';
  };
  const verify = f.runner.verify;
  f.runner.verify = async (t,s,d,checkpoint) => { await verify(t,s,d,checkpoint); if(t.kind==='research') completedResearch++; };
  await f.engine.run(); assert.equal(maxResearch,2); assert.equal(maxBuilders,1);
  assert.deepEqual(f.events.slice(0,3),['R1','R2','R3']);
  assert.ok(f.events.slice(3).every(id=>id==='B1'||id==='B2'));
});
test('retry exhaustion blocks dependent tasks and never treats failure as success', async () => {
  const f=fixture(bundle([task('A'),task('B','implementation',['A'])]));
  f.runner.verify=async()=>{throw new Error('failed check');};
  const state=await f.engine.run();
  assert.equal(state.tasks.A!.attempts,2); assert.equal(state.tasks.A!.phase,'failed'); assert.equal(state.tasks.B!.phase,'blocked');
  await f.engine.resume(); assert.equal(f.saved.tasks.A!.phase,'failed');
});
test('failed checks become safe repair metadata for the next builder and remain bounded', async () => {
  const f=fixture(); const received: TaskState['attemptHistory'][]=[];
  f.runner.work=async (_t,s) => { received.push(structuredClone(s.attemptHistory)); return 'done'; };
  f.runner.verify=async (_t,s) => {
    if (s.attempts === 1) { s.checks=[{name:'test',passed:false,exitCode:7,timedOut:false}]; throw new Error('check failed'); }
    s.review={sessionID:'review',passed:true,criteria:[{criterion:'Expected behavior is present',passed:true,evidence:'fixture'}]};
  };
  const state=await f.engine.run(), taskState=state.tasks['TASK-001']!;
  assert.equal(taskState.phase,'verified'); assert.equal(taskState.attempts,2);
  assert.equal(received[1]![0]!.failure,'check-failed'); assert.equal(received[1]![0]!.checkName,'test');
  assert.equal(received[1]![0]!.exitCode,7); assert.equal(received[1]![0]!.timedOut,false);
  assert.doesNotMatch(JSON.stringify(taskState.attemptHistory),/check failed/);
});
test('unchanged-tree review protocol failure retries review without rerunning the builder', async () => {
  const f=fixture(); let verifyCalls=0,reviewCalls=0;
  f.runner.verify=async()=>{verifyCalls++; throw new ReviewRetryableError('review-protocol','review-session-1');};
  f.runner.review=async (_t,s)=>{reviewCalls++; s.review={sessionID:'review-session-2',passed:true,criteria:[{criterion:'Expected behavior is present',passed:true,evidence:'fixture'}]};};
  const state=await f.engine.run(), taskState=state.tasks['TASK-001']!;
  assert.equal(state.tasks['TASK-001']!.phase,'verified'); assert.equal(taskState.attempts,2);
  assert.equal(f.events.length,1); assert.equal(verifyCalls,1); assert.equal(reviewCalls,1);
  assert.equal(taskState.attemptHistory![0]!.failure,'review-protocol');
});
test('research review-only retry preserves stable input provenance for dependent work', async () => {
  const f=fixture(bundle([task('R','research'),task('B','implementation',['R'])])); let researchVerifyCalls=0,reviewCalls=0;
  f.runner.verify=async (t,s)=>{if(t.id==='R' && ++researchVerifyCalls===1) throw new ReviewRetryableError('review-protocol','research-review-1'); s.review={sessionID:'research-review-2',passed:true,criteria:[{criterion:'Expected behavior is present',passed:true,evidence:'fixture'}]};};
  f.runner.review=async (_t,s)=>{reviewCalls++; s.review={sessionID:'research-review-2',passed:true,criteria:[{criterion:'Expected behavior is present',passed:true,evidence:'fixture'}]};};
  const state=await f.engine.run(),research=state.tasks.R!;
  assert.equal(research.phase,'verified'); assert.equal(research.attempts,2); assert.equal(research.attemptHistory![0]!.failure,'review-protocol');
  assert.equal(research.researchInputFingerprint,'a'.repeat(64)); assert.equal(f.events.filter(id=>id==='R').length,1);
  assert.equal(reviewCalls,1); assert.equal(researchVerifyCalls,1); assert.equal(state.tasks.B!.phase,'verified');
});
test('review-only retry is refused if the worktree changed after the failed review', async () => {
  const f=fixture(); let verifyCalls=0,reviewCalls=0;
  f.runner.verify=async (_t,s)=>{
    verifyCalls++;
    if (verifyCalls===1) { f.treeFingerprint='b'.repeat(64); throw new ReviewRetryableError('review-transport','review-session'); }
    s.review={sessionID:'review',passed:true,criteria:[{criterion:'Expected behavior is present',passed:true,evidence:'fixture'}]};
  };
  f.runner.review=async()=>{reviewCalls++;};
  const state=await f.engine.run();
  assert.equal(state.tasks['TASK-001']!.phase,'verified'); assert.equal(state.tasks['TASK-001']!.attempts,2);
  assert.equal(f.events.length,2); assert.equal(reviewCalls,0);
});
test('active or unknown native session prevents duplicate automatic retry', async () => {
  const f=fixture(); f.runner.verify=async()=>{throw new Error('transport failure');}; f.runner.idle=async()=>false;
  const state=await f.engine.run(); assert.equal(state.tasks['TASK-001']!.phase,'blocked'); assert.equal(state.tasks['TASK-001']!.attempts,1);
  await assert.rejects(f.engine.resume(), /still active/);
});
test('restart blocks interrupted execution until explicit resume', async () => {
  const f=fixture(); const state=await f.engine.status(); state.directory='fixture-worktree';
  state.tasks['TASK-001']={ phase:'running', attempts:1, sessions:['orphan'],checks:[],attemptHistory:[] }; f.saved=state;
  assert.equal((await f.engine.run()).tasks['TASK-001']!.phase,'blocked'); assert.equal(f.events.length,0);
  await f.engine.resume(); assert.equal((await f.engine.run()).tasks['TASK-001']!.phase,'verified');
});
test('run lock rejects concurrent commands; digest drift and corrupt state fail closed', async () => {
  const f=fixture(); let release!:()=>void;
  f.runner.work=async()=>new Promise<string>(resolve=>{release=()=>resolve('done');});
  const running=f.engine.run();
  while (!release) await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(f.engine.run(), /already active/); release(); await running;
  const changed=bundle(); changed.spec.title='changed';
  await assert.rejects(new Engine(changed,f.store,f.runner).status(), /differs/);
  f.saved.tasks['TASK-001']!.attemptHistory=[{attempt:1,mode:'builder',failure:'worker-failed',stdout:'raw output'} as unknown as NonNullable<TaskState['attemptHistory']>[number]];
  await assert.rejects(f.engine.status(),/Corrupt stored attempt history/);
  f.saved.tasks['TASK-001']!.phase='fake' as TaskState['phase'];
  await assert.rejects(f.engine.status(), /Corrupt/);
});
test('reverify repeats gates and records failures without rerunning builders', async () => {
  const f=fixture(); await f.engine.run(); f.runner.verify=async()=>{throw new Error('regression');};
  const state=await f.engine.run(true); assert.equal(f.events.length,1); assert.equal(state.tasks['TASK-001']!.phase,'failed');
});
test('permission rejection propagates to host without retry or swallowing the native error', async () => {
  const f=fixture(); const denied=new Error('native denial');
  f.runner.work=async()=>{throw new ExecutionStopped('Native permission denied',{cause:denied});};
  await assert.rejects(f.engine.run(),error=>error===denied);
  assert.equal(f.saved.tasks['TASK-001']!.phase,'blocked'); assert.equal(f.saved.tasks['TASK-001']!.attempts,1);
});
test('reverification also propagates native permission denial', async () => {
  const f=fixture(); await f.engine.run(); const denied=new Error('native denial');
  f.runner.verify=async()=>{throw new ExecutionStopped('Native permission denied',{cause:denied});};
  await assert.rejects(f.engine.run(true),error=>error===denied);
  assert.equal(f.saved.tasks['TASK-001']!.phase,'blocked');
});
test('v1 migration preserves sessions and history but requires explicit verification without rebuilding', async () => {
  const f=fixture();
  f.saved={version:1,digest:digest(f.engine.bundle),directory:'fixture-worktree',tasks:{'TASK-001':{phase:'verified',attempts:2,sessions:['worker-old','review-old'],checks:[{name:'test',passed:true,exitCode:0,timedOut:false}],review:{sessionID:'review-old',passed:true,criteria:[]}}}} as unknown as State;
  const migrated=await f.engine.status();
  assert.equal(migrated.version,3); assert.equal(migrated.tasks['TASK-001']!.sessions[0],'worker-old'); assert.equal(migrated.currentVerification!.current,false);
  assert.deepEqual(migrated.tasks['TASK-001']!.attemptHistory,[]); assert.equal(f.saved.version,3);
  await f.engine.run(); assert.equal(f.events.length,0); assert.equal(f.saved.tasks['TASK-001']!.phase,'verified');
  const verified=await f.engine.run(true);
  assert.equal(f.events.length,0); assert.equal(verified.currentVerification!.current,true); assert.equal(verified.tasks['TASK-001']!.verification!.fingerprint,'a'.repeat(64));
});
test('v2 migration preserves evidence and marks legacy research historical until explicit refresh', async () => {
  const f=fixture(bundle([task('R','research'),task('B','implementation',['R'])]));
  await f.engine.run();
  const v2=structuredClone(f.saved) as unknown as Record<string,unknown>;
  v2.version=2;
  for (const taskState of Object.values(v2.tasks as Record<string,Record<string,unknown>>)) { delete taskState.attemptHistory; delete taskState.researchInputFingerprint; }
  f.saved=v2 as unknown as State;
  const migrated=await f.engine.status();
  assert.equal(migrated.version,3); assert.deepEqual(migrated.tasks.R!.sessions,f.saved.tasks.R!.sessions);
  assert.deepEqual(migrated.tasks.R!.checks,f.saved.tasks.R!.checks); assert.deepEqual(migrated.tasks.R!.attemptHistory,[]);
  assert.equal(migrated.tasks.R!.verification,undefined); assert.ok(migrated.tasks.R!.historicalVerification);
  assert.deepEqual(migrated.historicalResearchTaskIDs,['R']); assert.equal(migrated.currentVerification!.current,false);
  assert.equal(f.saved.version,3);
  const before=f.events.length; await f.engine.run(); await f.engine.run(true);
  assert.equal(f.events.length,before); assert.deepEqual(f.saved.tasks.R!.researchInputFingerprint,undefined);
});
test('research mutation fails within the existing retry budget and cannot unlock dependents', async () => {
  const f=fixture(bundle([task('R','research'),task('B','implementation',['R'])]));
  f.runner.work=async (t,_s,_d,checkpoint)=>{
    f.events.push(t.id);
    if(t.id==='R') f.treeFingerprint=(f.events.filter(id=>id==='R').length===1?'b':'c').repeat(64);
    await checkpoint(); return 'done';
  };
  const state=await f.engine.run();
  assert.deepEqual(f.events,['R','R']); assert.equal(state.tasks.R!.attempts,2); assert.equal(state.tasks.R!.phase,'failed');
  assert.equal(state.tasks.R!.researchInputFingerprint,undefined); assert.equal(state.tasks.R!.attemptHistory!.length,2);
  assert.equal(state.tasks.B!.phase,'blocked');
});
test('stale research input after a completed run blocks dependent work until explicit refresh', async () => {
  const f=fixture(bundle([task('R','research'),task('B','implementation',['R'])]));
  await f.engine.run();
  const partial=structuredClone(f.saved);
  partial.tasks.B={phase:'pending',attempts:0,sessions:[],checks:[],attemptHistory:[]};
  f.saved=partial;
  f.treeFingerprint='b'.repeat(64);
  const stale=await f.engine.run();
  assert.deepEqual(f.events,['R','B']); assert.equal(stale.tasks.B!.phase,'blocked');
  assert.deepEqual(stale.historicalResearchTaskIDs,['R']);
  assert.equal(stale.currentVerification!.current,false);
  const refreshed=await f.engine.refreshResearch();
  assert.equal(refreshed.tasks.R!.researchInputFingerprint,'b'.repeat(64));
  assert.equal(refreshed.tasks.B!.phase,'pending');
  assert.equal(refreshed.executionFingerprint,'b'.repeat(64));
  assert.deepEqual(f.events,['R','B','R']);
  await f.engine.run(); assert.deepEqual(f.events,['R','B','R','B']);
});
test('v2 nonresearch verification is historical until explicit verify and is not replayed by execute', async () => {
  const f=fixture(); await f.engine.run();
  const v2=structuredClone(f.saved) as unknown as Record<string,unknown>; v2.version=2;
  for(const taskState of Object.values(v2.tasks as Record<string,Record<string,unknown>>)){delete taskState.attemptHistory;delete taskState.researchInputFingerprint;delete taskState.historicalVerification;}
  delete v2.executionFingerprint; f.saved=v2 as unknown as State;
  const migrated=await f.engine.status();
  assert.equal(migrated.migrationRequired,true); assert.equal(migrated.currentVerification!.current,false);
  assert.ok(migrated.tasks['TASK-001']!.historicalVerification); assert.equal(migrated.tasks['TASK-001']!.verification,undefined);
  const before=f.events.length; await f.engine.run(); assert.equal(f.events.length,before);
  const current=await f.engine.run(true); assert.equal(f.events.length,before); assert.equal(current.currentVerification!.current,true);
});
test('explicit research refresh records a stable input without replaying builders', async () => {
  const f=fixture(bundle([task('R','research'),task('B','implementation',['R'])]));
  await f.engine.run();
  const legacy=structuredClone(f.saved); delete legacy.tasks.R!.researchInputFingerprint; f.saved=legacy;
  const buildersBefore=f.events.filter(id=>id==='B').length, researchBefore=f.events.filter(id=>id==='R').length;
  const refreshed=await f.engine.refreshResearch();
  assert.equal(refreshed.tasks.R!.phase,'verified'); assert.match(refreshed.tasks.R!.researchInputFingerprint!,/^[0-9a-f]{64}$/);
  assert.equal(f.events.filter(id=>id==='R').length,researchBefore+1); assert.equal(f.events.filter(id=>id==='B').length,buildersBefore);
});
test('verification mutations fail closed and later tree edits make final evidence stale', async () => {
  const f=fixture(); await f.engine.run();
  f.mutateDuringVerify=true;
  const changed=await f.engine.run(true);
  assert.equal(changed.tasks['TASK-001']!.phase,'failed'); assert.equal(changed.currentVerification!.current,false); assert.equal(changed.finalVerification,undefined);
  f.mutateDuringVerify=false; f.treeFingerprint='a'.repeat(64); await f.engine.run(true);
  f.treeFingerprint='c'.repeat(64);
  const stale=await f.engine.status(); assert.equal(stale.currentVerification!.current,false); assert.equal(stale.currentVerification!.fingerprint,'c'.repeat(64));
  assert.equal(stale.executionNeedsVerification,true);
  const before=f.events.length;
  const resumed=await f.engine.resume(); assert.equal(resumed.currentVerification!.current,false);
  const held=await f.engine.run(); assert.equal(held.executionNeedsVerification,true); assert.equal(f.events.length,before);
  const repaired=await f.engine.run(true); assert.equal(repaired.currentVerification!.current,true); assert.equal(f.events.length,before);
});
test('final verification binds every completed task to one common tree fingerprint', async () => {
  const f=fixture(bundle([task('A','research'),task('B','implementation',['A'])]));
  await f.engine.run(); const state=await f.engine.run(true);
  assert.equal(state.currentVerification!.current,true);
  assert.deepEqual(state.finalVerification!.taskIDs,['A','B']);
  assert.ok(Object.values(state.tasks).every(taskState => taskState.verification?.fingerprint === state.finalVerification!.fingerprint));
});
