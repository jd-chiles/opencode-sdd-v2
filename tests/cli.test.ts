import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { init, doctor } from '../packages/cli/src/index.js';
import { approve, assertApproval, loadBundle, safePath, installFiles, readJSON, validate } from '../packages/cli/src/project.js';
import { digest } from '../packages/core/src/index.js';
import { bundle, temp, writeBundle } from './fixtures.js';

test('init creates seven agents, skill/templates and preserves user OpenCode settings and edited artifacts', async t => {
  const root=await temp(t); const settings='{"plugins":["other"],"models":{"private":"unchanged"}}';
  await writeFile(join(root,'opencode.json'),settings);
  const first=await init(root); assert.equal(first.created.filter(x=>x.startsWith('.opencode/agents/')).length,7);
  await writeBundle(root); const second=await init(root); assert.equal(second.created.length,0);
  assert.equal(await readFile(join(root,'opencode.json'),'utf8'),settings);
  await approve(root); assert.equal((await doctor(root)).ok,true);
});
test('unconfigured init fails doctor with actionable offline diagnostics', async t => {
  const root=await temp(t); await init(root); const result=await doctor(root);
  assert.equal(result.ok,false); assert.match(result.diagnostics.join('\n'),/models.implementation/);
});
test('approval rejects artifact drift and cannot approve malformed task plans', async t => {
  const root=await temp(t); await init(root); await writeBundle(root); await approve(root);
  await assertApproval(root,await loadBundle(root));
  const b=await loadBundle(root); b.spec.title='changed'; await writeBundle(root,b);
  await assert.rejects(assertApproval(root,await loadBundle(root)),/stale/);
  b.plan.tasks=[]; await writeBundle(root,b); await assert.rejects(approve(root),/Tasks empty/);
});
test('validation reports structural defects and CLI validate returns failure', async t => {
  const root=await temp(t); await init(root); await writeBundle(root);
  await writeFile(join(root,'.opencode-sdd/plan.json'),JSON.stringify({ version:1, specID:'feature-001', tasks:[] }));
  const report=await validate(root); assert.equal(report.ok,false); assert.deepEqual(report.errors.map(error=>error.code),['STRUCTURAL_INVALID']);
  const result=spawnSync(process.execPath,['dist/packages/cli/src/index.js','validate',root],{encoding:'utf8'});
  assert.equal(result.status,1); assert.match(result.stdout,/STRUCTURAL_INVALID/);
});
test('quality warnings require explicit acknowledgement bound to the bundle digest', async t => {
  const root=await temp(t); await init(root); const b=bundle([{ ...bundle().plan.tasks[0]!, kind:'research', checks:[] }]); await writeBundle(root,b);
  const report=await validate(root); assert.equal(report.ok,true); assert.deepEqual(report.warnings.map(warning=>warning.code),['QUALITY_REQUIREMENT_NO_CHECKS','QUALITY_REQUIREMENT_RESEARCH_ONLY']);
  await assert.rejects(approve(root),/--accept-warnings/);
  const refused=spawnSync(process.execPath,['dist/packages/cli/src/index.js','approve',root],{encoding:'utf8'}); assert.equal(refused.status,1); assert.match(refused.stderr,/--accept-warnings/);
  const accepted=spawnSync(process.execPath,['dist/packages/cli/src/index.js','approve','--accept-warnings',root],{encoding:'utf8'}); assert.equal(accepted.status,0);
  const approvedBundle=await loadBundle(root); const approval=JSON.parse(await readFile(join(root,'.opencode-sdd/approval.json'),'utf8')) as Record<string,unknown>;
  assert.equal(approval.digest,digest(approvedBundle)); assert.deepEqual(approval.acknowledgedWarningCodes,['QUALITY_REQUIREMENT_NO_CHECKS','QUALITY_REQUIREMENT_RESEARCH_ONLY']);
  assert.deepEqual(report.requirements[0],{ requirementID:'REQ-001', taskIDs:['TASK-001'], acceptance:[{ taskID:'TASK-001', criterion:'Expected behavior is present' }], checks:[] }); await assertApproval(root,approvedBundle);
});
test('warning-free approval needs no acknowledgement and records an empty warning set', async t => {
  const root=await temp(t); await init(root); await writeBundle(root); const report=await validate(root);
  assert.equal(report.ok,true); assert.deepEqual(report.warnings,[]); await approve(root);
  const approval=JSON.parse(await readFile(join(root,'.opencode-sdd/approval.json'),'utf8')) as Record<string,unknown>;
  assert.deepEqual(approval.acknowledgedWarningCodes,[]); await assertApproval(root,await loadBundle(root));
});
test('conflicts preflight before any write and preserve customized agents', async t => {
  const root=await temp(t); await init(root);
  const path=join(root,'.opencode/agents/sdd-review.md'); await writeFile(path,'custom agent');
  await assert.rejects(init(root),/Existing file differs/); assert.equal(await readFile(path,'utf8'),'custom agent');
  await assert.rejects(installFiles(root,{'new-file':'new','.opencode/agents/sdd-review.md':'different'}));
  await assert.rejects(readFile(join(root,'new-file')), { code:'ENOENT' });
});
test('initializer and approval refuse symlink destinations and traversal', async t => {
  const root=await temp(t); const outside=await temp(t);
  await symlink(outside,join(root,'.opencode'),'junction');
  await assert.rejects(init(root),/Symlink/);
  await assert.rejects(safePath(root,'../outside'),/inside project/);
  if (process.platform === 'win32') await assert.rejects(safePath(root,'Z:\\outside'), /inside project/);
  const another=await temp(t); await writeBundle(another);
  await symlink(outside,join(another,'.opencode-sdd/approval.json'),'junction');
  await assert.rejects(approve(another),/Symlink/);
});
test('malformed, oversized JSON and CLI usage errors return explicit failure', async t => {
  const root=await temp(t); await mkdir(join(root,'.opencode-sdd')); await writeFile(join(root,'.opencode-sdd/config.json'),'{');
  await assert.rejects(readJSON(root,'.opencode-sdd/config.json'),/invalid JSON/);
  await writeFile(join(root,'.opencode-sdd/config.json'),'x'.repeat(1_000_001));
  await assert.rejects(readJSON(root,'.opencode-sdd/config.json'),/smaller/);
  const result=spawnSync(process.execPath,['dist/packages/cli/src/index.js','migrate'],{encoding:'utf8'});
  assert.equal(result.status,1); assert.match(result.stderr,/Usage/);
});
