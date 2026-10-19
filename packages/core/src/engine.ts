import { digest, type Bundle, type Task } from './contracts.js';

export type Phase = 'pending' | 'running' | 'review' | 'verified' | 'failed' | 'blocked';
export type CheckEvidence = { name: string; passed: boolean; exitCode: number | null; timedOut: boolean; fingerprint?: string };
export type ReviewEvidence = { sessionID: string; passed: boolean; fingerprint?: string; criteria: { criterion: string; passed: boolean; evidence: string }[] };
export type VerificationEvidence = { fingerprint: string; verifiedAt: string };
export type AttemptFailure = 'check-failed' | 'review-rejected' | 'review-transport' | 'review-protocol' | 'worktree-changed' | 'worker-failed';
export type AttemptSummary = {
  attempt: number;
  mode: 'builder' | 'review-only';
  failure: AttemptFailure;
  checkName?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  reviewSessionID?: string;
};
export type TaskState = {
  phase: Phase;
  attempts: number;
  sessions: string[];
  output?: string;
  error?: string;
  checks: CheckEvidence[];
  review?: ReviewEvidence;
  verification?: VerificationEvidence;
  historicalVerification?: VerificationEvidence;
  attemptHistory?: AttemptSummary[];
  researchInputFingerprint?: string;
};
export type CurrentVerification = { fingerprint: string | null; current: boolean };
export type State = {
  version: 3;
  digest: string;
  directory?: string;
  /** Last stable worktree checkpoint observed by execution; distinguishes later external edits from task output. */
  executionFingerprint?: string;
  tasks: Record<string, TaskState>;
  finalVerification?: { fingerprint: string; taskIDs: string[]; verifiedAt: string };
  migrationRequired?: boolean;
  currentVerification?: CurrentVerification;
  /** Transient signal used to recommend re-verification after an out-of-band tree edit. */
  executionNeedsVerification?: boolean;
  /** Transient status projection; never persisted. */
  historicalResearchTaskIDs?: string[];
};
type PreviousTaskState = Omit<TaskState, 'attemptHistory' | 'researchInputFingerprint'>;
export type StateV2 = {
  version: 2;
  digest: string;
  directory?: string;
  tasks: Record<string, PreviousTaskState>;
  finalVerification?: State['finalVerification'];
  migrationRequired?: boolean;
};
export type LegacyState = {
  version: 1;
  digest: string;
  directory?: string;
  tasks: Record<string, Omit<PreviousTaskState, 'verification'>>;
};
export interface Store { load(): Promise<State | StateV2 | LegacyState | undefined>; save(state: State): Promise<void> }
/** Stops admission/retries while preserving a host permission error for the caller. */
export class ExecutionStopped extends Error {}
/** A review transport/protocol failure eligible for a bounded review-only retry. */
export class ReviewRetryableError extends Error {
  constructor(readonly kind: 'review-transport' | 'review-protocol', readonly sessionID?: string) {
    super(kind === 'review-transport' ? 'Review transport failed' : 'Review response protocol failed');
    this.name = 'ReviewRetryableError';
  }
}
export interface Runner {
  prepare(state: State, checkpoint: () => Promise<void>): Promise<void>;
  work(task: Task, state: TaskState, directory: string, checkpoint: () => Promise<void>): Promise<string>;
  /** Run configured executable checks and then independent review. */
  verify(task: Task, state: TaskState, directory: string, checkpoint: () => Promise<void>): Promise<void>;
  /** Rerun only independent review, without repeating configured checks. */
  review(task: Task, state: TaskState, directory: string, checkpoint: () => Promise<void>): Promise<void>;
  fingerprint(directory: string): Promise<string>;
  idle(sessionID: string): Promise<boolean>;
}

function validFingerprint(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value); }
function validAttemptSummary(value: unknown): value is AttemptSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const allowed = new Set(['attempt','mode','failure','checkName','exitCode','timedOut','reviewSessionID']);
  if (Object.keys(record).some(key => !allowed.has(key))) return false;
  if (!Number.isInteger(record.attempt) || (record.attempt as number) < 1) return false;
  if (record.mode !== 'builder' && record.mode !== 'review-only') return false;
  if (!['check-failed','review-rejected','review-transport','review-protocol','worktree-changed','worker-failed'].includes(String(record.failure))) return false;
  if (record.checkName !== undefined && (typeof record.checkName !== 'string' || record.checkName.length > 128)) return false;
  if (record.exitCode !== undefined && record.exitCode !== null && !Number.isInteger(record.exitCode)) return false;
  if (record.timedOut !== undefined && typeof record.timedOut !== 'boolean') return false;
  if (record.reviewSessionID !== undefined && (typeof record.reviewSessionID !== 'string' || record.reviewSessionID.length > 256)) return false;
  return true;
}
function reviewPassed(taskState: TaskState): boolean { return !!(taskState.review as ReviewEvidence | undefined)?.passed; }
function errorMessage(summary: AttemptSummary): string {
  switch (summary.failure) {
    case 'check-failed': return `Check ${summary.checkName ?? 'unknown'} failed (exit=${summary.exitCode ?? 'unknown'}, timeout=${summary.timedOut === true})`;
    case 'review-rejected': return `Acceptance review rejected${summary.reviewSessionID ? `: ${summary.reviewSessionID}` : ''}`;
    case 'review-transport': return `Review transport failed${summary.reviewSessionID ? `; inspect ${summary.reviewSessionID}` : ''}`;
    case 'review-protocol': return `Review response was invalid${summary.reviewSessionID ? `; inspect ${summary.reviewSessionID}` : ''}`;
    case 'worktree-changed': return 'Worktree changed during research or verification; evidence was rejected';
    default: return 'Native worker failed; inspect recorded session IDs';
  }
}

export class Engine {
  private active = false;
  private writes: Promise<void> = Promise.resolve();
  constructor(readonly bundle: Bundle, private store: Store, private runner: Runner) {}

  private save(state: State): Promise<void> {
    const snapshot = structuredClone(state);
    delete snapshot.currentVerification;
    delete snapshot.historicalResearchTaskIDs;
    delete snapshot.executionNeedsVerification;
    this.writes = this.writes.then(() => this.store.save(snapshot));
    return this.writes;
  }

  private historicalResearch(state: State, currentFingerprint?: string | null): string[] {
    return this.bundle.plan.tasks
      .filter(task => {
        const taskState = state.tasks[task.id];
        return task.kind === 'research' && taskState?.phase === 'verified'
          && (!taskState.researchInputFingerprint || !currentFingerprint || taskState.researchInputFingerprint !== currentFingerprint);
      })
      .map(task => task.id);
  }

  private currentTaskEvidence(taskID: string, state: State, currentFingerprint: string): boolean {
    const task = this.bundle.plan.tasks.find(candidate => candidate.id === taskID);
    const taskState = state.tasks[taskID];
    if (taskState?.phase !== 'verified' || (state.migrationRequired && !taskState.verification)) return false;
    return task?.kind !== 'research' || taskState.researchInputFingerprint === currentFingerprint;
  }

  async status(): Promise<State> {
    const saved = await this.store.load();
    let state: State;
    if (saved) {
      if (![1, 2, 3].includes(saved.version) || saved.digest !== digest(this.bundle)) throw new Error('Stored workflow differs from approved artifacts; use a new spec id');
      if (Object.keys(saved.tasks).length !== this.bundle.plan.tasks.length) throw new Error('Corrupt stored task inventory');
      for (const task of this.bundle.plan.tasks) {
        const taskState = saved.tasks[task.id] as TaskState | undefined;
        if (!taskState || !['pending','running','review','verified','failed','blocked'].includes(taskState.phase) || !Number.isInteger(taskState.attempts) || taskState.attempts < 0 || !Array.isArray(taskState.sessions) || !taskState.sessions.every(session => typeof session === 'string') || !Array.isArray(taskState.checks)) throw new Error('Corrupt stored task state');
        if (saved.version === 3) {
          if (!Array.isArray(taskState.attemptHistory) || taskState.attemptHistory.length > this.bundle.config.execution.maxAttempts || !taskState.attemptHistory.every(validAttemptSummary)) throw new Error('Corrupt stored attempt history');
          if (taskState.researchInputFingerprint !== undefined && !validFingerprint(taskState.researchInputFingerprint)) throw new Error('Corrupt research input fingerprint');
          if (taskState.verification && (!validFingerprint(taskState.verification.fingerprint) || typeof taskState.verification.verifiedAt !== 'string')) throw new Error('Corrupt stored verification evidence');
          if (taskState.historicalVerification && (!validFingerprint(taskState.historicalVerification.fingerprint) || typeof taskState.historicalVerification.verifiedAt !== 'string')) throw new Error('Corrupt stored historical verification evidence');
        } else if (saved.version === 2 && taskState.verification && (!validFingerprint(taskState.verification.fingerprint) || typeof taskState.verification.verifiedAt !== 'string')) throw new Error('Corrupt stored verification evidence');
      }
      if (saved.version === 3 && saved.executionFingerprint !== undefined && !validFingerprint(saved.executionFingerprint)) throw new Error('Corrupt execution fingerprint');
      if (saved.version !== 1 && saved.finalVerification && (!validFingerprint(saved.finalVerification.fingerprint) || typeof saved.finalVerification.verifiedAt !== 'string' || !Array.isArray(saved.finalVerification.taskIDs) || saved.finalVerification.taskIDs.length !== this.bundle.plan.tasks.length || this.bundle.plan.tasks.some(task => !saved.finalVerification!.taskIDs.includes(task.id)))) throw new Error('Corrupt final verification record');
      const migrating = saved.version !== 3;
      const v1 = saved.version === 1;
      state = {
        ...saved,
        version: 3,
        tasks: structuredClone(saved.tasks) as Record<string, TaskState>,
        ...(migrating ? { migrationRequired: Object.values(saved.tasks).some(task => task.phase === 'verified') || (saved.version === 2 && saved.migrationRequired) } : {}),
        ...(v1 ? { finalVerification: undefined } : {}),
      } as State;
      for (const taskState of Object.values(state.tasks)) {
        if (taskState.phase === 'running' || taskState.phase === 'review') { taskState.phase = 'blocked'; taskState.error = 'Interrupted execution; inspect sessions before sdd-resume'; }
        if (migrating) taskState.attemptHistory = [];
        if (migrating && taskState.verification) {
          taskState.historicalVerification = taskState.verification;
          delete taskState.verification;
        }
        if (v1) delete taskState.verification;
      }
      if (migrating) await this.save(state);
    } else {
      state = {
        version: 3,
        digest: digest(this.bundle),
        tasks: Object.fromEntries(this.bundle.plan.tasks.map(task => [task.id, { phase: 'pending', attempts: 0, sessions: [], checks: [], attemptHistory: [] }])),
      };
    }
    const fingerprint = state.directory ? await this.runner.fingerprint(state.directory).catch(() => null) : null;
    const historicalResearchTaskIDs = this.historicalResearch(state, fingerprint);
    const current = !!fingerprint && !state.migrationRequired && historicalResearchTaskIDs.length === 0 && !!state.finalVerification && state.finalVerification.fingerprint === fingerprint && this.bundle.plan.tasks.every(task => state.tasks[task.id]?.verification?.fingerprint === fingerprint);
    state.currentVerification = { fingerprint, current };
    state.historicalResearchTaskIDs = historicalResearchTaskIDs;
    state.executionNeedsVerification = !!fingerprint && Object.values(state.tasks).some(taskState => taskState.phase === 'verified')
      && ((!!state.executionFingerprint && state.executionFingerprint !== fingerprint)
        || (!!state.finalVerification && state.finalVerification.fingerprint !== fingerprint)
        || this.bundle.plan.tasks.some(task => state.tasks[task.id]?.verification && state.tasks[task.id]?.verification?.fingerprint !== fingerprint));
    return state;
  }

  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active) throw new Error('Workflow already active');
    this.active = true;
    try { return await fn(); } finally { this.active = false; }
  }

  private async assertSessionsIdle(state: State): Promise<void> {
    for (const taskState of Object.values(state.tasks)) for (const sessionID of taskState.sessions) {
      if (!await this.runner.idle(sessionID)) throw new Error(`Session ${sessionID} is still active; inspect or interrupt in OpenCode first`);
    }
  }

  async resume(): Promise<State> {
    return this.exclusive(async () => {
      const state = await this.status();
      await this.assertSessionsIdle(state);
      for (const taskState of Object.values(state.tasks)) if (taskState.phase !== 'verified' && taskState.attempts < this.bundle.config.execution.maxAttempts) {
        taskState.phase = 'pending'; delete taskState.error;
      }
      await this.save(state); return state;
    });
  }

  private recordFailure(taskState: TaskState, attempt: number, mode: AttemptSummary['mode'], error: unknown): AttemptSummary {
    const check = taskState.checks.find(candidate => !candidate.passed);
    let summary: AttemptSummary;
    if (check) summary = { attempt, mode, failure: 'check-failed', checkName: check.name.slice(0, 128), exitCode: check.exitCode, timedOut: check.timedOut };
    else if (error instanceof ReviewRetryableError) summary = { attempt, mode, failure: error.kind, ...(error.sessionID ? { reviewSessionID: error.sessionID.slice(0, 256) } : {}) };
    else if (taskState.review && !taskState.review.passed) summary = { attempt, mode, failure: 'review-rejected', reviewSessionID: taskState.review.sessionID.slice(0, 256) };
    else if (error instanceof Error && error.message.startsWith('Worktree changed')) summary = { attempt, mode, failure: 'worktree-changed' };
    else summary = { attempt, mode, failure: 'worker-failed' };
    taskState.attemptHistory ??= [];
    taskState.attemptHistory.push(summary);
    taskState.attemptHistory = taskState.attemptHistory.slice(-this.bundle.config.execution.maxAttempts);
    taskState.error = errorMessage(summary);
    return summary;
  }

  private async executeTask(task: Task, state: State): Promise<void> {
    const taskState = state.tasks[task.id]!;
    const directory = state.directory!;
    let retryReviewOnly = false;
    while (taskState.attempts < this.bundle.config.execution.maxAttempts) {
      taskState.attempts++;
      const attempt = taskState.attempts;
      let reviewStart: string | undefined;
      const mode: AttemptSummary['mode'] = retryReviewOnly ? 'review-only' : 'builder';
      if (retryReviewOnly) {
        taskState.phase = 'review';
        await this.save(state);
        let reviewBefore: string | undefined;
        try {
          reviewBefore = await this.runner.fingerprint(directory);
          await this.runner.review(task, taskState, directory, () => this.save(state));
          const after = await this.runner.fingerprint(directory);
          if (reviewBefore !== after) throw new Error('Worktree changed during independent review');
          if (!reviewPassed(taskState)) throw new Error('Independent review did not pass every criterion');
          taskState.verification = { fingerprint: after, verifiedAt: new Date().toISOString() };
          taskState.phase = 'verified'; delete taskState.error;
          retryReviewOnly = false;
          await this.save(state);
          return;
        } catch (error) {
          if (error instanceof ExecutionStopped) {
            taskState.phase = 'blocked'; taskState.error = error.message;
            await this.save(state); throw error.cause ?? error;
          }
          const failure = this.recordFailure(taskState, attempt, mode, error);
          const unchanged = error instanceof ReviewRetryableError && !!reviewBefore && reviewBefore === (await this.runner.fingerprint(directory).catch(() => null));
          retryReviewOnly = error instanceof ReviewRetryableError && unchanged;
          taskState.phase = 'failed';
          await this.save(state);
          if (!(await Promise.all(taskState.sessions.map(id => this.runner.idle(id).catch(() => false)))).every(Boolean)) {
            taskState.phase = 'blocked'; taskState.error = 'Session may still be active; inspect before sdd-resume';
            await this.save(state); return;
          }
          if (!retryReviewOnly && failure.mode === 'review-only') retryReviewOnly = false;
          continue;
        }
      }

      taskState.phase = 'running'; taskState.checks = []; delete taskState.review; delete taskState.error;
      await this.save(state);
      let researchInputFingerprint: string | undefined;
      try {
        if (task.kind === 'research') researchInputFingerprint = await this.runner.fingerprint(directory);
        taskState.output = await this.runner.work(task, taskState, directory, () => this.save(state));
        if (researchInputFingerprint && await this.runner.fingerprint(directory) !== researchInputFingerprint) throw new Error('Worktree changed during research');
        // Persist stable research provenance before review so a bounded review-only
        // retry retains the input state that the research findings describe.
        if (researchInputFingerprint) {
          taskState.researchInputFingerprint = researchInputFingerprint;
          await this.save(state);
        }
        taskState.phase = 'review'; await this.save(state);
        reviewStart = await this.runner.fingerprint(directory);
        await this.runner.verify(task, taskState, directory, () => this.save(state));
        const after = await this.runner.fingerprint(directory);
        if (reviewStart !== after) throw new Error('Worktree changed during verification');
        if (researchInputFingerprint && reviewStart !== researchInputFingerprint) throw new Error('Worktree changed during research verification');
        if (!reviewPassed(taskState)) throw new Error('Independent review did not pass every criterion');
        taskState.verification = { fingerprint: after, verifiedAt: new Date().toISOString() };
        if (researchInputFingerprint) taskState.researchInputFingerprint = researchInputFingerprint;
        taskState.phase = 'verified'; delete taskState.error;
        await this.save(state);
        retryReviewOnly = false;
        return;
      } catch (error) {
        if (error instanceof ExecutionStopped) {
          taskState.phase = 'blocked'; taskState.error = error.message;
          await this.save(state); throw error.cause ?? error;
        }
        const failure = this.recordFailure(taskState, attempt, mode, error);
        const unchanged = error instanceof ReviewRetryableError && !!reviewStart && (await this.runner.fingerprint(directory).catch(() => null)) === reviewStart;
        retryReviewOnly = unchanged;
        taskState.phase = 'failed';
        await this.save(state);
        // Provider errors can leave a native session running. Never duplicate it.
        if (!(await Promise.all(taskState.sessions.map(id => this.runner.idle(id).catch(() => false)))).every(Boolean)) {
          taskState.phase = 'blocked'; taskState.error = 'Session may still be active; inspect before sdd-resume';
          await this.save(state); return;
        }
        if (failure.failure !== 'review-transport' && failure.failure !== 'review-protocol') retryReviewOnly = false;
      }
    }
  }

  async run(reverify = false): Promise<State> {
    return this.exclusive(async () => {
      const state = await this.status();
      for (const taskState of Object.values(state.tasks)) if (taskState.phase === 'running' || taskState.phase === 'review') {
        taskState.phase = 'blocked'; taskState.error = 'Interrupted execution; inspect sessions then use sdd-resume';
      }
      await this.save(state);
      if (Object.values(state.tasks).some(taskState => taskState.phase === 'blocked')
        || (!reverify && Object.values(state.tasks).some(taskState => taskState.phase === 'failed'))) return state;
      if (!reverify && state.migrationRequired && Object.values(state.tasks).some(taskState => taskState.phase === 'verified' && !taskState.verification)) return state;
      await this.runner.prepare(state, () => this.save(state)); await this.save(state);
      if (!state.directory) throw new Error('Runner did not supply an execution directory');
      if (reverify) {
        const finalFingerprint = await this.runner.fingerprint(state.directory);
        let allPassed = true;
        for (const task of this.bundle.plan.tasks) if (state.tasks[task.id]!.phase === 'verified' || (state.tasks[task.id]!.phase === 'failed' && !!state.tasks[task.id]!.verification)) {
          const taskState = state.tasks[task.id]!;
          if (task.kind === 'research' && taskState.researchInputFingerprint !== finalFingerprint) { allPassed = false; continue; }
          taskState.phase = 'review'; await this.save(state);
          try {
            const before = await this.runner.fingerprint(state.directory);
            await this.runner.verify(task, taskState, state.directory, () => this.save(state));
            const after = await this.runner.fingerprint(state.directory);
            if (before !== finalFingerprint || after !== finalFingerprint) throw new Error('Worktree changed during verification');
            if (!reviewPassed(taskState)) throw new Error('Independent review did not pass every criterion');
            taskState.verification = { fingerprint: finalFingerprint, verifiedAt: new Date().toISOString() }; taskState.phase = 'verified'; delete taskState.error;
          } catch (error) {
            if (error instanceof ExecutionStopped) { taskState.phase = 'blocked'; taskState.error = error.message; await this.save(state); throw error.cause ?? error; }
            allPassed = false; taskState.phase = 'failed'; taskState.error = 'Verification failed or worktree changed; inspect native sessions and check evidence';
          }
          await this.save(state);
        }
        const afterAll = await this.runner.fingerprint(state.directory);
        const noHistoricalResearch = this.historicalResearch(state, afterAll).length === 0;
        if (allPassed && afterAll === finalFingerprint) state.executionFingerprint = afterAll;
        state.executionNeedsVerification = !!state.executionFingerprint && state.executionFingerprint !== afterAll;
        if (allPassed && noHistoricalResearch && afterAll === finalFingerprint && this.bundle.plan.tasks.every(task => state.tasks[task.id]!.phase === 'verified' && state.tasks[task.id]!.verification?.fingerprint === finalFingerprint)) {
          state.finalVerification = { fingerprint: finalFingerprint, taskIDs: this.bundle.plan.tasks.map(task => task.id), verifiedAt: new Date().toISOString() };
          state.migrationRequired = false;
        } else delete state.finalVerification;
        state.currentVerification = { fingerprint: afterAll, current: !!state.finalVerification && afterAll === finalFingerprint };
        state.historicalResearchTaskIDs = this.historicalResearch(state, afterAll);
        await this.save(state);
        return state;
      }

      delete state.finalVerification;
      const startingFingerprint = await this.runner.fingerprint(state.directory);
      const hasVerifiedHistory = Object.values(state.tasks).some(taskState => taskState.phase === 'verified');
      if (hasVerifiedHistory && state.executionFingerprint && state.executionFingerprint !== startingFingerprint) {
        for (const task of this.bundle.plan.tasks) {
          const taskState = state.tasks[task.id]!;
          if (taskState.phase === 'pending' && task.dependencies.some(dependency => !this.currentTaskEvidence(dependency, state, startingFingerprint))) {
            taskState.phase = 'blocked'; taskState.error = 'Dependency not verified';
          }
        }
        state.currentVerification = { fingerprint: startingFingerprint, current: false };
        state.historicalResearchTaskIDs = this.historicalResearch(state, startingFingerprint);
        state.executionNeedsVerification = true;
        await this.save(state);
        return state;
      }
      state.executionFingerprint ??= startingFingerprint;
      while (true) {
        const currentFingerprint = await this.runner.fingerprint(state.directory);
        const ready = this.bundle.plan.tasks.filter(task => state.tasks[task.id]!.phase === 'pending' && task.dependencies.every(dependency => this.currentTaskEvidence(dependency, state, currentFingerprint)));
        const readyResearch = ready.filter(task => task.kind === 'research').slice(0, this.bundle.config.execution.maxParallelResearch);
        const batch = readyResearch.length ? readyResearch : ready.filter(task => task.kind === 'implementation').slice(0, 1);
        if (!batch.length) break;
        const outcomes = await Promise.allSettled(batch.map(task => this.executeTask(task, state)));
        const rejected = outcomes.find(outcome => outcome.status === 'rejected');
        if (rejected?.status === 'rejected') throw rejected.reason;
        state.executionFingerprint = await this.runner.fingerprint(state.directory);
      }
      for (const task of this.bundle.plan.tasks) if (state.tasks[task.id]!.phase === 'pending') {
        state.tasks[task.id]!.phase = 'blocked'; state.tasks[task.id]!.error = 'Dependency not verified';
      }
      const currentFingerprint = await this.runner.fingerprint(state.directory);
      state.executionFingerprint = currentFingerprint;
      state.currentVerification = { fingerprint: currentFingerprint, current: false };
      state.historicalResearchTaskIDs = this.historicalResearch(state, currentFingerprint);
      state.executionNeedsVerification = false;
      await this.save(state); return state;
    });
  }

  async refreshResearch(): Promise<State> {
    return this.exclusive(async () => {
      const state = await this.status();
      const initialFingerprint = state.directory ? await this.runner.fingerprint(state.directory) : null;
      const targets = this.bundle.plan.tasks.filter(task => task.kind === 'research' && state.tasks[task.id]?.phase === 'verified'
        && (!state.tasks[task.id]?.researchInputFingerprint || state.tasks[task.id]?.researchInputFingerprint !== initialFingerprint));
      if (!targets.length) return state;
      if (targets.some(task => state.tasks[task.id]!.attempts >= this.bundle.config.execution.maxAttempts)) throw new Error('Research refresh exceeds the existing maxAttempts budget; revise the approved workflow to allocate a new attempt budget');
      await this.assertSessionsIdle(state);
      await this.runner.prepare(state, () => this.save(state)); await this.save(state);
      if (!state.directory) throw new Error('Runner did not supply an execution directory');
      for (const task of targets) {
        const taskState = state.tasks[task.id]!;
        taskState.phase = 'pending'; delete taskState.error; delete taskState.researchInputFingerprint;
        await this.save(state);
        await this.executeTask(task, state);
      }
      const refreshFingerprint = await this.runner.fingerprint(state.directory);
      if (targets.every(task => this.currentTaskEvidence(task.id, state, refreshFingerprint))) state.executionFingerprint = refreshFingerprint;
      for (const task of this.bundle.plan.tasks) {
        const taskState = state.tasks[task.id]!;
        if (taskState.phase === 'blocked' && taskState.error === 'Dependency not verified' && task.dependencies.every(dependency => this.currentTaskEvidence(dependency, state, refreshFingerprint))) {
          taskState.phase = 'pending'; delete taskState.error;
        }
      }
      await this.save(state);
      return this.status();
    });
  }
}
