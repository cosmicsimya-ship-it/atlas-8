import { execFileSync, spawnSync } from 'child_process';

export function isWindows() {
  return process.platform === 'win32';
}

export function isProcessRunning(pid) {
  const n = Number(pid);
  if (!n || Number.isNaN(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function runPowerShell(script) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', windowsHide: true },
  );
  return (result.stdout || '').trim();
}

export function getProcessCommandLine(pid) {
  if (!isWindows() || !isProcessRunning(pid)) return null;
  try {
    const escaped = String(pid).replace(/'/g, "''");
    const out = runPowerShell(
      `(Get-CimInstance Win32_Process -Filter \"ProcessId=${escaped}\" -ErrorAction SilentlyContinue).CommandLine`,
    );
    return out || null;
  } catch {
    return null;
  }
}

export function getListeningPidForPort(port) {
  if (!isWindows()) return null;
  try {
    const script = `$c=Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){$c.OwningProcess}`;
    const out = runPowerShell(script);
    const pid = parseInt(out, 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function resolveNpmCmd() {
  if (!isWindows()) return 'npm';
  try {
    const out = execFileSync('where.exe', ['npm.cmd'], { encoding: 'utf8', windowsHide: true });
    const line = out.split(/\r?\n/).find((l) => l.trim().endsWith('npm.cmd'));
    return line?.trim() || 'npm.cmd';
  } catch {
    return 'npm.cmd';
  }
}

export function resolveNodeCmd() {
  if (!isWindows()) return process.execPath;
  try {
    const out = execFileSync('where.exe', ['node.exe'], { encoding: 'utf8', windowsHide: true });
    const line = out.split(/\r?\n/).find((l) => l.trim().endsWith('node.exe'));
    return line?.trim() || process.execPath;
  } catch {
    return process.execPath;
  }
}

function isAtlasServiceScript(cmdLower, role) {
  if (role === 'backend') {
    return cmdLower.includes('server\\index.js') || cmdLower.includes('server/index.js');
  }
  if (role === 'telegram') {
    return cmdLower.includes('server\\telegram.js') || cmdLower.includes('server/telegram.js');
  }
  if (role === 'frontend') {
    return cmdLower.includes('vite') || (cmdLower.includes('npm') && cmdLower.includes('dev'));
  }
  return false;
}

function belongsToProjectPath(cmdLower, projectRoot) {
  const rootLower = projectRoot.toLowerCase().replace(/\//g, '\\');
  const rootForward = projectRoot.toLowerCase().replace(/\\/g, '/');
  const folderMarker = projectRoot.split(/[/\\]/).filter(Boolean).pop()?.toLowerCase() ?? '';
  return (
    cmdLower.includes(rootLower) ||
    cmdLower.includes(rootForward) ||
    (folderMarker.length > 8 && cmdLower.includes(folderMarker))
  );
}

/**
 * Verify PID belongs to this Atlas project and expected service role.
 * @param {number} pid
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {'backend'|'frontend'|'telegram'} opts.role
 * @param {number} [opts.expectedPort]
 */
export function getProcessWorkingDirectory(pid) {
  if (!isWindows() || !isProcessRunning(pid)) return null;
  try {
    const escaped = String(pid).replace(/'/g, "''");
    const out = runPowerShell(
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${escaped}" -ErrorAction SilentlyContinue).WorkingSetSize;` +
      `$p=Get-Process -Id ${escaped} -ErrorAction SilentlyContinue;` +
      `if($p){Split-Path -Parent ([System.Diagnostics.FileVersionInfo]::GetVersionInfo($p.MainModule.FileName).FileName) -ErrorAction SilentlyContinue}`,
    );
    return out || null;
  } catch {
    return null;
  }
}

export function getProcessCwd(pid) {
  if (!isWindows() || !isProcessRunning(pid)) return null;
  try {
    const escaped = String(pid).replace(/'/g, "''");
    const out = runPowerShell(
      `try { $proc = [System.Diagnostics.Process]::GetProcessById(${escaped}); ` +
      `$proc.MainModule.FileName } catch { '' }`,
    );
    return out || null;
  } catch {
    return null;
  }
}

export function isAtlasOwnedProcess(pid, { projectRoot, role, expectedPort = null }) {
  if (!isProcessRunning(pid)) return false;
  const cmd = getProcessCommandLine(pid) || '';
  if (!cmd) return false;

  const cmdLower = cmd.toLowerCase();
  if (!isAtlasServiceScript(cmdLower, role)) return false;

  // Full path match in command line
  if (belongsToProjectPath(cmdLower, projectRoot)) return true;

  // Relative path command (e.g. "node server/telegram.js" started from project root)
  // Verify via lock file ownership for telegram role
  if (role === 'telegram') {
    // If command is exactly "node server/telegram.js" style (no absolute project path),
    // and the script name matches, treat as owned — the lock file itself is the authority
    const isRelativeTelegram =
      (cmdLower.endsWith('server/telegram.js') || cmdLower.endsWith('server\\telegram.js')) &&
      !cmdLower.includes(':\\') && !cmdLower.includes(':/') ||
      cmdLower.match(/server[/\\]telegram\.js/);
    if (isRelativeTelegram) return true;
  }

  if (role === 'backend') {
    const isRelativeBackend =
      cmdLower.match(/server[/\\]index\.js/) &&
      (!cmdLower.includes(':\\') && !cmdLower.includes(':/'));
    if (isRelativeBackend) return true;
  }

  if (expectedPort != null) {
    const portPid = getListeningPidForPort(expectedPort);
    if (portPid === pid) return true;
  }

  return false;
}

export function describeTaskResultCode(code) {
  const n = Number(code);
  if (Number.isNaN(n)) return 'unknown';
  const map = {
    0: 'success',
    267009: 'task is currently running',
    267011: 'task is disabled',
    267014: 'task has not run yet',
    267015: 'no more runs scheduled',
    2147946720: 'operation failed',
    2147942405: 'access denied',
    1: 'general error',
  };
  if (map[n] !== undefined) return map[n];
  if (n < 0) {
    const unsigned = n >>> 0;
    return map[unsigned] || `exit code ${n} (0x${unsigned.toString(16)})`;
  }
  return `exit code ${n}`;
}

export function runSchtasks(args) {
  const result = spawnSync('schtasks.exe', args, { encoding: 'utf8', windowsHide: true });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

export function runCmdFile(command, args, options = {}) {
  return spawnSync(command, args, { windowsHide: true, ...options });
}
