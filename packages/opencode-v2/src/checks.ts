import { spawn } from 'node:child_process';
import type { CheckEvidence } from '../../core/src/index.js';

/** Do not retain stdout/stderr: test output can contain credentials or private data. */
export function runCheck(name: string, argv: string[], directory: string, timeoutMs: number, signal?: AbortSignal): Promise<CheckEvidence> {
  return new Promise(resolve => {
    if (!argv[0] || signal?.aborted) return resolve({ name, passed: false, exitCode: null, timedOut: false });
    let timedOut = false, settled = false;
    const child = spawn(argv[0], argv.slice(1), { cwd: directory, shell: false, stdio: 'ignore', windowsHide: true, detached: process.platform !== 'win32' });
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, shell: false });
        killer.once('error', () => child.kill('SIGKILL'));
        killer.once('close', code => { if (code !== 0) child.kill('SIGKILL'); });
      } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
    };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    signal?.addEventListener('abort', stop, { once: true });
    const finish = (exitCode: number | null) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', stop);
      resolve({ name, passed: exitCode === 0 && !timedOut && !signal?.aborted, exitCode, timedOut });
    };
    child.once('error', () => finish(null)); child.once('close', finish);
  });
}
