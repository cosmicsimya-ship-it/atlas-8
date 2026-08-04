import 'dotenv/config';
import { acquireStartupLock, releaseStartupLock } from './lock.mjs';
import { writeLog } from './log.mjs';
import { assertProjectRoot, getProjectRoot } from './paths.mjs';
import {
  formatServiceLine,
  inspectAllServices,
  startService,
  stopService,
} from './services.mjs';

const START_ORDER = ['backend', 'frontend', 'telegram'];
const STOP_ORDER = ['telegram', 'frontend', 'backend'];

export async function atlasStart(options = {}) {
  const root = assertProjectRoot(options.root ?? getProjectRoot());
  const lock = acquireStartupLock(root);
  if (!lock.acquired) {
    writeLog(lock.reason, { root, level: 'warn' });
    console.error(`Atlas Startup: ${lock.reason}`);
    process.exitCode = 1;
    return { ok: false, reason: lock.reason };
  }

  writeLog('Atlas startup begin', { root });
  const results = [];

  try {
    for (const key of START_ORDER) {
      const result = await startService(key, root);
      results.push(result);
      writeLog(`${key}: ${result.message ?? result.state}`, {
        root,
        level: result.state === 'failed' ? 'error' : 'info',
      });
      console.log(formatServiceLine(result));
      if (result.started) {
        console.log(`  → ${result.message ?? 'started'}`);
      } else if (result.message) {
        console.log(`  → ${result.message}`);
      }
    }

    const final = await inspectAllServices(root);
    const failed = final.filter((s) => s.state === 'failed');
    writeLog(`Atlas startup finished (${failed.length} failed)`, { root });
    console.log('\nAtlas Startup Summary');
    for (const s of final) console.log(formatServiceLine(s));

    if (failed.length > 0) {
      process.exitCode = 1;
      return { ok: false, services: final };
    }
    return { ok: true, services: final };
  } finally {
    releaseStartupLock(root);
  }
}

export async function atlasStop(options = {}) {
  const root = assertProjectRoot(options.root ?? getProjectRoot());
  writeLog('Atlas stop begin', { root });
  const results = [];

  for (const key of STOP_ORDER) {
    const result = await stopService(key, root);
    results.push(result);
    writeLog(`${key}: ${result.message ?? result.state}`, { root });
    console.log(`${result.label}: ${result.message ?? result.state}`);
  }

  const final = await inspectAllServices(root);
  writeLog('Atlas stop finished', { root });
  return { ok: true, services: final, results };
}

export async function atlasStatus(options = {}) {
  const root = assertProjectRoot(options.root ?? getProjectRoot());
  const services = await inspectAllServices(root);
  return { root, services };
}

export async function atlasRestart(options = {}) {
  const root = assertProjectRoot(options.root ?? getProjectRoot());
  writeLog('Atlas restart begin', { root });
  await atlasStop({ root });
  return atlasStart({ root });
}

export function printStatusReport(status) {
  console.log('\nAtlas Services');
  for (const s of status.services) {
    console.log(formatServiceLine(s));
  }
}
