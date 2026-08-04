import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PATHS, STARTUP_LOCK_STALE_MS } from './config.mjs';
import { getDataDir, getProjectRoot } from './paths.mjs';
import { isProcessRunning } from './process-win.mjs';

function getLockPath(root = getProjectRoot()) {
  return join(getDataDir(root), PATHS.startupLock);
}

export function readStartupLock(root = getProjectRoot()) {
  const lockPath = getLockPath(root);
  if (!existsSync(lockPath)) return null;
  try {
    const raw = readFileSync(lockPath, 'utf8').trim();
    const [pidText, startedAtText] = raw.split(':');
    return {
      pid: parseInt(pidText, 10),
      startedAt: Number(startedAtText) || statSync(lockPath).mtimeMs,
      path: lockPath,
    };
  } catch {
    return { pid: NaN, startedAt: 0, path: lockPath };
  }
}

export function releaseStartupLock(root = getProjectRoot()) {
  const lockPath = getLockPath(root);
  if (!existsSync(lockPath)) return;
  try {
    const lock = readStartupLock(root);
    if (lock?.pid === process.pid || !isProcessRunning(lock?.pid)) {
      unlinkSync(lockPath);
    }
  } catch {
    /* ignore */
  }
}

export function acquireStartupLock(root = getProjectRoot()) {
  const dataDir = getDataDir(root);
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const lockPath = getLockPath(root);
  const existing = readStartupLock(root);
  if (existing && existsSync(lockPath)) {
    const age = Date.now() - existing.startedAt;
    if (isProcessRunning(existing.pid)) {
      return { acquired: false, reason: `Startup already in progress (PID ${existing.pid}).` };
    }
    if (age < STARTUP_LOCK_STALE_MS) {
      /* stale owner, remove */
    }
    try {
      unlinkSync(lockPath);
    } catch {
      return { acquired: false, reason: 'Could not clear stale startup lock.' };
    }
  }

  writeFileSync(lockPath, `${process.pid}:${Date.now()}`, 'utf8');
  return { acquired: true, path: lockPath };
}
