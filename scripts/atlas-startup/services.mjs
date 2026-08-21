import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { SERVICES } from './config.mjs';
import {
  getPidPath,
  getPollLockPath,
  getProjectRoot,
  getDataDir,
} from './paths.mjs';
import {
  getListeningPidForPort,
  getProcessCommandLine,
  isAtlasOwnedProcess,
  isProcessRunning,
  resolveNodeCmd,
  resolveNpmCmd,
} from './process-win.mjs';

function readPidFile(path) {
  if (!existsSync(path)) return null;
  try {
    const pid = parseInt(readFileSync(path, 'utf8').trim(), 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function writePidFile(path, pid) {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, String(pid), 'utf8');
}

function removePidFile(path) {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* ignore */
  }
}

async function waitForHttpOk(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok || res.status < 500) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function ownershipOptions(serviceKey, service) {
  return {
    role: serviceKey,
    expectedPort: service.port ?? null,
  };
}

function owns(root, serviceKey, pid) {
  return isAtlasOwnedProcess(pid, {
    projectRoot: root,
    ...ownershipOptions(serviceKey, SERVICES[serviceKey]),
  });
}

export function getTelegramPollLockOwner(root = getProjectRoot()) {
  const lockPath = getPollLockPath(root);
  if (!existsSync(lockPath)) return null;
  try {
    const pid = parseInt(readFileSync(lockPath, 'utf8').trim(), 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function cleanStaleTelegramArtifacts(root = getProjectRoot()) {
  const pidPath = getPidPath(SERVICES.telegram, root);
  const lockPath = getPollLockPath(root);
  const pid = readPidFile(pidPath);
  const lockPid = existsSync(lockPath)
    ? parseInt(readFileSync(lockPath, 'utf8').trim(), 10)
    : null;

  if (pid && !owns(root, 'telegram', pid)) {
    removePidFile(pidPath);
  } else if (pid && !isProcessRunning(pid)) {
    removePidFile(pidPath);
  }

  if (lockPid && !isProcessRunning(lockPid)) {
    try {
      unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  } else if (
    lockPid &&
    isProcessRunning(lockPid) &&
    !owns(root, 'telegram', lockPid)
  ) {
    /* foreign process holds lock — do not touch */
  }
}

/**
 * @returns {Promise<{key:string,label:string,state:'running'|'stopped'|'failed'|'skipped',pid:number|null,port:number|null,detail:string}>}
 */
export async function inspectService(serviceKey, root = getProjectRoot()) {
  const service = SERVICES[serviceKey];
  const pidPath = getPidPath(service, root);
  let pid = readPidFile(pidPath);
  let port = service.port ?? null;
  let detail = '';

  if (port) {
    const portPid = getListeningPidForPort(port);
    if (portPid) {
      if (owns(root, serviceKey, portPid)) {
        pid = portPid;
        if (!existsSync(pidPath) || readPidFile(pidPath) !== portPid) {
          writePidFile(pidPath, portPid);
        }
      } else if (portPid && !pid) {
        return {
          key: serviceKey,
          label: service.label,
          state: 'failed',
          pid: portPid,
          port,
          detail: `Port ${port} in use by non-Atlas process (PID ${portPid}).`,
        };
      }
    }
  }

  if (serviceKey === 'telegram') {
    cleanStaleTelegramArtifacts(root);
    pid = readPidFile(pidPath);
    const lockPid = getTelegramPollLockOwner(root);
    if (lockPid && isProcessRunning(lockPid)) {
      if (owns(root, 'telegram', lockPid)) {
        pid = lockPid;
        writePidFile(pidPath, lockPid);
        return {
          key: serviceKey,
          label: service.label,
          state: 'running',
          pid: lockPid,
          port: null,
          detail: 'polling active',
        };
      }
      return {
        key: serviceKey,
        label: service.label,
        state: 'failed',
        pid: lockPid,
        port: null,
        detail: `Telegram poll lock held by foreign process (PID ${lockPid}).`,
      };
    }
    if (pid && owns(root, 'telegram', pid)) {
      return {
        key: serviceKey,
        label: service.label,
        state: 'running',
        pid,
        port: null,
        detail: 'polling active',
      };
    }
    if (pid && isProcessRunning(pid) && !owns(root, 'telegram', pid)) {
      removePidFile(pidPath);
      return {
        key: serviceKey,
        label: service.label,
        state: 'stopped',
        pid: null,
        port: null,
        detail: 'Stale PID file ignored (foreign process).',
      };
    }
    if (pid && !isProcessRunning(pid)) {
      removePidFile(pidPath);
    }
    if (service.requiresEnv && !process.env[service.requiresEnv]) {
      return {
        key: serviceKey,
        label: service.label,
        state: 'skipped',
        pid: null,
        port: null,
        detail: `${service.requiresEnv} not set — Telegram not started.`,
      };
    }
    return {
      key: serviceKey,
      label: service.label,
      state: 'stopped',
      pid: null,
      port: null,
      detail: 'stopped',
    };
  }

  if (pid && isProcessRunning(pid) && owns(root, serviceKey, pid)) {
    if (service.healthUrl) {
      const ok = await waitForHttpOk(service.healthUrl(port), 5000);
      return {
        key: serviceKey,
        label: service.label,
        state: ok ? 'running' : 'running',
        pid,
        port,
        detail: ok ? 'healthy' : 'port/process active (health check inconclusive)',
      };
    }
    return { key: serviceKey, label: service.label, state: 'running', pid, port, detail: 'running' };
  }

  if (pid && isProcessRunning(pid) && !owns(root, serviceKey, pid)) {
    removePidFile(pidPath);
    detail = 'Stale PID file ignored (foreign process).';
    pid = null;
  } else if (pid && !isProcessRunning(pid)) {
    removePidFile(pidPath);
    pid = null;
  }

  if (port) {
    const portPid = getListeningPidForPort(port);
    if (portPid && owns(root, serviceKey, portPid)) {
      writePidFile(pidPath, portPid);
      return {
        key: serviceKey,
        label: service.label,
        state: 'running',
        pid: portPid,
        port,
        detail: 'detected via port',
      };
    }
    if (portPid) {
      return {
        key: serviceKey,
        label: service.label,
        state: 'failed',
        pid: portPid,
        port,
        detail: `Port ${port} in use by non-Atlas process (PID ${portPid}).`,
      };
    }
  }

  return {
    key: serviceKey,
    label: service.label,
    state: 'stopped',
    pid: null,
    port,
    detail: detail || 'stopped',
  };
}

export async function inspectAllServices(root = getProjectRoot()) {
  const keys = ['backend', 'frontend', 'telegram'];
  const results = [];
  for (const key of keys) {
    results.push(await inspectService(key, root));
  }
  return results;
}

function appendProcessEvent(logPath, event, fields = {}) {
  if (!logPath) return;
  const line = JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...fields,
  });
  writeFileSync(logPath, `${line}\n`, { encoding: 'utf8', flag: 'a' });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Telegram is ready only after its own heartbeat is observed and it remains
 * alive/conflict-free for a full stability window.
 */
export async function observeTelegramReadiness({
  pid,
  startedAtMs,
  timeoutMs,
  observationMs,
  pollMs,
  isAlive,
  readHeartbeat,
  hasConflict,
  wait = sleep,
  now = Date.now,
}) {
  const heartbeatDeadline = now() + timeoutMs;
  let heartbeatObserved = false;
  let observationDeadline = null;

  while (true) {
    if (hasConflict()) {
      return { ok: false, reason: 'conflict' };
    }
    if (!isAlive(pid)) {
      return { ok: false, reason: 'early_exit' };
    }

    const heartbeat = readHeartbeat();
    const heartbeatAt = Date.parse(heartbeat?.lastUpdateAt ?? '');
    if (
      heartbeat?.pid === pid &&
      Number.isFinite(heartbeatAt) &&
      heartbeatAt >= startedAtMs
    ) {
      if (!heartbeatObserved) {
        heartbeatObserved = true;
        observationDeadline = now() + observationMs;
      }
      if (now() >= observationDeadline) {
        return { ok: true, reason: 'stable' };
      }
    } else if (!heartbeatObserved && now() >= heartbeatDeadline) {
      return { ok: false, reason: 'heartbeat_timeout' };
    }

    await wait(pollMs);
  }
}

function readTelegramHeartbeat(root) {
  const path = join(getDataDir(root), 'telegram.heartbeat.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readLogSince(logPath, byteOffset) {
  if (!logPath || !existsSync(logPath)) return '';
  try {
    return readFileSync(logPath).subarray(byteOffset).toString('utf8');
  } catch {
    return '';
  }
}

export async function cleanupFailedTelegramStart(root, pid) {
  const pidPath = getPidPath(SERVICES.telegram, root);
  if (isProcessRunning(pid) && owns(root, 'telegram', pid)) {
    try {
      process.kill(pid);
    } catch {
      /* process may have exited between checks */
    }
    const deadline = Date.now() + 2000;
    while (isProcessRunning(pid) && Date.now() < deadline) {
      await sleep(100);
    }
  }

  if (readPidFile(pidPath) === pid) removePidFile(pidPath);

  const lockPath = getPollLockPath(root);
  const lockPid = getTelegramPollLockOwner(root);
  if (existsSync(lockPath) && (lockPid === pid || !isProcessRunning(lockPid))) {
    try {
      unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  }
}

function spawnDetached(command, args, root, options = {}) {
  // Windows: spawning *.cmd/*.bat with detached:true without shell throws EINVAL.
  const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const logPath = options.logFile ? join(root, options.logFile) : null;
  let stdoutFd = null;
  let stderrFd = null;
  if (logPath) {
    mkdirSync(dirname(logPath), { recursive: true });
    stdoutFd = openSync(logPath, 'a');
    stderrFd = openSync(logPath, 'a');
    appendProcessEvent(logPath, 'spawn_requested', { service: options.serviceKey ?? 'unknown' });
  }

  let child;
  try {
    child = spawn(command, args, {
      cwd: root,
      detached: true,
      stdio: logPath ? ['ignore', stdoutFd, stderrFd] : 'ignore',
      windowsHide: true,
      shell: needsShell,
      env: { ...process.env },
    });
  } finally {
    if (stdoutFd != null) closeSync(stdoutFd);
    if (stderrFd != null) closeSync(stderrFd);
  }
  if (logPath) {
    appendProcessEvent(logPath, 'spawned', {
      service: options.serviceKey ?? 'unknown',
      pid: child.pid,
    });
    child.once('error', (error) => {
      appendProcessEvent(logPath, 'spawn_error', {
        service: options.serviceKey ?? 'unknown',
        code: error?.code ?? 'unknown',
      });
    });
    child.once('exit', (code, signal) => {
      appendProcessEvent(logPath, 'process_exit_observed', {
        service: options.serviceKey ?? 'unknown',
        pid: child.pid,
        code: code ?? null,
        signal: signal ?? null,
      });
    });
  }
  child.unref();
  return child.pid;
}

export async function startService(serviceKey, root = getProjectRoot()) {
  const service = SERVICES[serviceKey];
  const current = await inspectService(serviceKey, root);

  if (current.state === 'running') {
    return { ...current, started: false, message: 'Already running — skipped.' };
  }
  if (current.state === 'skipped') {
    return { ...current, started: false, message: current.detail };
  }
  if (current.state === 'failed') {
    return { ...current, started: false, message: current.detail };
  }

  if (serviceKey === 'telegram') {
    cleanStaleTelegramArtifacts(root);
    const lockPid = getTelegramPollLockOwner(root);
    if (lockPid && isProcessRunning(lockPid)) {
      if (owns(root, 'telegram', lockPid)) {
        const running = await inspectService('telegram', root);
        return { ...running, started: false, message: 'Telegram polling already active — skipped.' };
      }
      return {
        key: serviceKey,
        label: service.label,
        state: 'failed',
        pid: lockPid,
        port: null,
        started: false,
        message: `Telegram poll lock held by foreign process (PID ${lockPid}). Not starting second poller.`,
      };
    }
    if (service.requiresEnv && !process.env[service.requiresEnv]) {
      return {
        key: serviceKey,
        label: service.label,
        state: 'skipped',
        pid: null,
        port: null,
        started: false,
        message: `${service.requiresEnv} not set — Telegram skipped.`,
      };
    }
  }

  let pid;
  let telegramStartedAtMs = null;
  let telegramLogOffset = 0;
  const nodeCmd = resolveNodeCmd();
  const npmCmd = resolveNpmCmd();

  if (serviceKey === 'telegram') {
    telegramStartedAtMs = Date.now();
    const telegramLogPath = service.logFile ? join(root, service.logFile) : null;
    if (telegramLogPath && existsSync(telegramLogPath)) {
      telegramLogOffset = readFileSync(telegramLogPath).length;
    }
  }

  if (service.scriptArgs) {
    pid = spawnDetached(nodeCmd, service.scriptArgs, root, {
      serviceKey,
      logFile: service.logFile,
    });
  } else if (service.npmScript) {
    pid = spawnDetached(npmCmd, ['run', service.npmScript], root, {
      serviceKey,
      logFile: service.logFile,
    });
  } else {
    throw new Error(`No start command configured for ${serviceKey}`);
  }

  writePidFile(getPidPath(service, root), pid);

  if (service.healthUrl && service.port) {
    const ok = await waitForHttpOk(service.healthUrl(service.port), service.healthTimeoutMs);
    if (!ok) {
      const cmd = getProcessCommandLine(pid);
      const alive = isProcessRunning(pid);
      return {
        key: serviceKey,
        label: service.label,
        state: alive ? 'failed' : 'failed',
        pid: alive ? pid : null,
        port: service.port,
        started: true,
        message: alive
          ? 'Process started but health check timed out.'
          : 'Process exited before health check passed.',
      };
    }
  } else if (serviceKey === 'telegram') {
    const telegramLogPath = service.logFile ? join(root, service.logFile) : null;
    const readiness = await observeTelegramReadiness({
      pid,
      startedAtMs: telegramStartedAtMs,
      timeoutMs: service.startTimeoutMs,
      observationMs: service.readinessObservationMs,
      pollMs: service.readinessPollMs,
      isAlive: isProcessRunning,
      readHeartbeat: () => readTelegramHeartbeat(root),
      hasConflict: () => /409\s+Conflict|polling conflict|terminated by other getUpdates/i.test(
        readLogSince(telegramLogPath, telegramLogOffset),
      ),
    });
    const lockPid = getTelegramPollLockOwner(root);
    if (readiness.ok && lockPid === pid && owns(root, 'telegram', pid)) {
      return {
        key: serviceKey,
        label: service.label,
        state: 'running',
        pid,
        port: null,
        started: true,
        message: 'Telegram bot ready after heartbeat stability window.',
      };
    }

    await cleanupFailedTelegramStart(root, pid);
    const reason = readiness.ok && lockPid !== pid
      ? 'polling lock not confirmed'
      : readiness.reason === 'conflict'
        ? '409 Conflict detected during readiness window'
        : readiness.reason === 'early_exit'
          ? 'process exited during readiness window'
          : 'heartbeat readiness timed out';
    return {
      key: serviceKey,
      label: service.label,
      state: 'failed',
      pid: null,
      port: null,
      started: true,
      message: `Telegram startup failed: ${reason}.`,
    };
  }

  return {
    ...(await inspectService(serviceKey, root)),
    started: true,
    message: `${service.label} started.`,
  };
}

export async function stopService(serviceKey, root = getProjectRoot()) {
  const service = SERVICES[serviceKey];
  const pidPath = getPidPath(service, root);
  const current = await inspectService(serviceKey, root);

  if (current.state !== 'running' || !current.pid) {
    removePidFile(pidPath);
    return { ...current, stopped: false, message: 'Not running.' };
  }

  const pid = current.pid;
  if (!owns(root, serviceKey, pid)) {
    removePidFile(pidPath);
    return {
      ...current,
      stopped: false,
      message: `PID ${pid} is not an Atlas ${serviceKey} process — not stopped.`,
    };
  }

  try {
    process.kill(pid);
  } catch (err) {
    return { ...current, stopped: false, message: `Could not stop PID ${pid}: ${err.message}` };
  }

  await new Promise((r) => setTimeout(r, 1000));
  removePidFile(pidPath);

  if (serviceKey === 'telegram') {
    const lockPath = getPollLockPath(root);
    const lockPid = getTelegramPollLockOwner(root);
    if (lockPid === pid && existsSync(lockPath)) {
      try {
        unlinkSync(lockPath);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    ...(await inspectService(serviceKey, root)),
    stopped: true,
    message: `${service.label} stopped.`,
  };
}

export function formatServiceLine(s) {
  const pidText = s.pid != null ? `PID ${s.pid}` : 'PID —';
  const portText = s.port != null ? `Port ${s.port}` : s.key === 'telegram' ? 'polling' : 'Port —';
  return `${s.label}: ${s.state} | ${pidText} | ${portText}${s.detail && s.detail !== s.state ? ` | ${s.detail}` : ''}`;
}
