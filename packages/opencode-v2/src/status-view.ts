import type { State, TaskState } from '../../core/src/index.js';

function evidenceFreshness(state: State): string {
  if (state.currentVerification?.current) return 'current';
  if (state.migrationRequired) return 'historical; final verification is required';
  if (state.historicalResearchTaskIDs?.length) return 'stale; research inputs changed or lack provenance';
  if (state.executionNeedsVerification) return 'stale; the worktree changed since the last execution checkpoint';
  if (Object.values(state.tasks).some(task => task.phase === 'verified')) return 'partial; final worktree verification is pending';
  return 'not yet verified';
}

function blockedTasks(tasks: Record<string, TaskState>): string[] {
  return Object.entries(tasks)
    .filter(([, task]) => task.phase === 'blocked' || task.phase === 'failed')
    .map(([id, task]) => `- ${id}: ${task.error ?? (task.phase === 'blocked' ? 'requires attention' : 'verification failed')}`);
}

function nextCommand(state: State): string {
  const tasks = Object.values(state.tasks);
  if (tasks.some(task => task.phase === 'running' || task.phase === 'review')) return '/sdd-status';
  if (state.historicalResearchTaskIDs?.length) return '/sdd-refresh-research';
  if (tasks.some(task => task.phase === 'blocked' || task.phase === 'failed')) return '/sdd-resume';
  if (state.migrationRequired || state.executionNeedsVerification) return '/sdd-verify';
  if (tasks.some(task => task.phase === 'pending')) return '/sdd-execute';
  if (tasks.some(task => task.phase === 'verified') && !state.currentVerification?.current) return '/sdd-verify';
  if (tasks.every(task => task.phase === 'verified')) return '/sdd-status';
  return '/sdd-execute';
}

/** A concise, human-facing projection of durable workflow state. */
export function renderStatus(state: State): string {
  const tasks = Object.values(state.tasks);
  const verified = tasks.filter(task => task.phase === 'verified').length;
  const active = tasks.filter(task => task.phase === 'running' || task.phase === 'review').length;
  const blockers = blockedTasks(state.tasks);
  const lines = [
    'SDD status',
    `Progress: ${verified}/${tasks.length} tasks verified${active ? `; ${active} in progress` : ''}`,
    `Evidence freshness: ${evidenceFreshness(state)}`,
  ];
  if (blockers.length) lines.push('Blockers:', ...blockers);
  lines.push(`Suggested next command: ${nextCommand(state)}`);
  return lines.join('\n');
}
