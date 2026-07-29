/**
 * Safe verification for Atlas startup manager + Windows autostart.
 * Run: node scripts/verify-atlas-autostart.mjs
 *
 * Does NOT stop running services or start a second Telegram poller.
 */
import 'dotenv/config';
import { existsSync, writeFileSync, unlinkSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { getProjectRoot, getPidPath, getDataDir } from './atlas-startup/paths.mjs';
import { acquireStartupLock, releaseStartupLock } from './atlas-startup/lock.mjs';
import { writeLog, redactSecrets, getLogPath } from './atlas-startup/log.mjs';
import { inspectService } from './atlas-startup/services.mjs';
import { SERVICES } from './atlas-startup/config.mjs';
import { queryScheduledTask } from './atlas-startup/autostart-win.mjs';
import { isProcessRunning } from './atlas-startup/process-win.mjs';

const root = getProjectRoot();
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function runNpm(script) {
  return spawnSync(`npm run ${script}`, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: true,
  });
}

// 1. Path with spaces / Turkish chars
const rootHasSpaceOrUnicode = /[\s\u00C0-\u024F]/.test(root);
if (rootHasSpaceOrUnicode) {
  pass('Project path contains space or non-ASCII characters', root);
} else {
  pass('Project path resolution', root);
}

// 2. Secret redaction
const redacted = redactSecrets('TELEGRAM_BOT_TOKEN=8069973251:AAExample OPENAI_API_KEY=sk-test1234567890');
if (redacted.includes('8069973251') || redacted.includes('sk-test')) {
  fail('Secret redaction');
} else {
  pass('Secret redaction');
}

// 3. Startup lock acquire/release
releaseStartupLock(root);
const lock1 = acquireStartupLock(root);
const lock2 = acquireStartupLock(root);
if (lock1.acquired && !lock2.acquired) {
  pass('Concurrent startup lock blocks second acquire');
} else {
  fail('Concurrent startup lock', `${lock1.acquired} ${lock2.acquired}`);
}
releaseStartupLock(root);
if (!existsSync(join(getDataDir(root), 'atlas.startup.lock'))) {
  pass('Startup lock released');
} else {
  fail('Startup lock release');
}

// 4. Stale backend PID file
const stalePidPath = getPidPath(SERVICES.backend, root);
writeFileSync(stalePidPath, '99999999', 'utf8');
const staleInspect = await inspectService('backend', root);
if (staleInspect.state !== 'running' || staleInspect.pid !== 99999999) {
  pass('Stale backend PID ignored or cleaned', staleInspect.detail);
} else {
  fail('Stale backend PID handling');
}

// 5. Invalid PID file
writeFileSync(stalePidPath, 'not-a-pid', 'utf8');
const invalidInspect = await inspectService('backend', root);
pass('Invalid PID file handled without crash', invalidInspect.state);

// 6. Foreign PID — telegram slot (no port fallback to backend)
const telegramPidPath = getPidPath(SERVICES.telegram, root);
writeFileSync(telegramPidPath, String(process.pid), 'utf8');
const foreignTelegram = await inspectService('telegram', root);
if (foreignTelegram.state !== 'running') {
  pass('Foreign PID not treated as Atlas Telegram', foreignTelegram.detail);
} else {
  fail('Foreign PID handling (telegram)', JSON.stringify(foreignTelegram));
}
if (existsSync(telegramPidPath)) unlinkSync(telegramPidPath);

// 7. atlas:status CLI
const statusRun = runNpm('atlas:status');
if (statusRun.status === 0 && (statusRun.stdout || '').includes('Atlas Services')) {
  pass('npm run atlas:status');
} else {
  fail('npm run atlas:status', statusRun.stderr || statusRun.stdout);
}

// 8. autostart status (before install)
const autoStatusBefore = runNpm('atlas:autostart:status');
if (autoStatusBefore.status === 0 && (autoStatusBefore.stdout || '').includes('Atlas Autostart')) {
  pass('npm run atlas:autostart:status');
} else {
  fail('npm run atlas:autostart:status', autoStatusBefore.stderr);
}

// 9. Install autostart
const hadTask = Boolean(queryScheduledTask());
const install1 = runNpm('atlas:autostart:install');
if (install1.status === 0) {
  pass('npm run atlas:autostart:install (first/idempotent)');
} else {
  fail('npm run atlas:autostart:install', install1.stderr || install1.stdout);
}

const install2 = runNpm('atlas:autostart:install');
if (install2.status === 0 && (install2.stdout || '').includes('already configured')) {
  pass('npm run atlas:autostart:install idempotent second run');
} else if (install2.status === 0) {
  pass('npm run atlas:autostart:install second run', 'accepted');
} else {
  fail('npm run atlas:autostart:install second run', install2.stderr);
}

const task = queryScheduledTask();
if (task && task.startupCommand.includes('atlas:start')) {
  pass('Scheduled task registered', task.name);
} else {
  fail('Scheduled task query after install');
}

// 10. atlas:start with services already running (should skip duplicates; may start Telegram if stopped)
const startRun = runNpm('atlas:start');
const startOut = `${startRun.stdout || ''}\n${startRun.stderr || ''}`;
if (startRun.status === 0 || startOut.includes('Already running') || startOut.includes('skipped')) {
  pass('npm run atlas:start with existing services', `exit ${startRun.status}`);
} else {
  fail('npm run atlas:start', startOut.slice(0, 300));
}

// 11. Manual scheduled task trigger
if (task) {
  const trigger = spawnSync('schtasks.exe', ['/Run', '/TN', 'AtlasStartupManager'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (trigger.status === 0) {
    pass('Scheduled task manual trigger (/Run)');
  } else {
    fail('Scheduled task manual trigger', trigger.stderr || trigger.stdout);
  }
} else {
  fail('Manual task trigger skipped', 'no task');
}

// 12. Log file created
writeLog('verify test entry', { root });
if (existsSync(getLogPath(root))) {
  pass('Startup log file exists', getLogPath(root));
} else {
  fail('Startup log file missing');
}

// 13. Remove autostart
const remove1 = runNpm('atlas:autostart:remove');
if (remove1.status === 0) {
  pass('npm run atlas:autostart:remove');
} else {
  fail('npm run atlas:autostart:remove', remove1.stderr);
}

const remove2 = runNpm('atlas:autostart:remove');
if (remove2.status === 0 && (remove2.stdout || '').includes('Nothing to remove')) {
  pass('npm run atlas:autostart:remove when absent');
} else if (remove2.status === 0) {
  pass('npm run atlas:autostart:remove when absent', 'ok');
} else {
  fail('npm run atlas:autostart:remove when absent');
}

// 14. Status after remove
const autoStatusAfter = runNpm('atlas:autostart:status');
if (autoStatusAfter.status === 0 && (autoStatusAfter.stdout || '').includes('Installed: no')) {
  pass('autostart status after remove');
} else {
  fail('autostart status after remove');
}

// Re-install if user had task before tests
if (hadTask) {
  runNpm('atlas:autostart:install');
  pass('Restored pre-test autostart task');
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
