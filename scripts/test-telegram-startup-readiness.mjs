import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cleanupFailedTelegramStart,
  observeTelegramReadiness,
} from './atlas-startup/services.mjs';

function harness(events) {
  let time = 0;
  let alive = true;
  let heartbeat = null;
  let conflict = false;

  return {
    options: {
      pid: 4242,
      startedAtMs: 0,
      timeoutMs: 100,
      observationMs: 40,
      pollMs: 10,
      isAlive: () => alive,
      readHeartbeat: () => heartbeat,
      hasConflict: () => conflict,
      now: () => time,
      wait: async (ms) => {
        time += ms;
        for (const event of events.filter((item) => !item.applied && item.at <= time)) {
          event.applied = true;
          if (event.type === 'heartbeat') {
            heartbeat = { pid: 4242, lastUpdateAt: new Date(event.at).toISOString() };
          } else if (event.type === 'exit') {
            alive = false;
          } else if (event.type === 'conflict') {
            conflict = true;
          }
        }
      },
    },
    get time() {
      return time;
    },
  };
}

{
  const h = harness([{ at: 10, type: 'heartbeat' }]);
  const result = await observeTelegramReadiness(h.options);
  assert.deepEqual(result, { ok: true, reason: 'stable' });
  assert.ok(h.time >= 50, 'must remain alive for the complete observation window');
}

{
  const h = harness([
    { at: 10, type: 'heartbeat' },
    { at: 40, type: 'conflict' },
  ]);
  assert.deepEqual(
    await observeTelegramReadiness(h.options),
    { ok: false, reason: 'conflict' },
  );
}

{
  const h = harness([
    { at: 10, type: 'heartbeat' },
    { at: 30, type: 'exit' },
  ]);
  assert.deepEqual(
    await observeTelegramReadiness(h.options),
    { ok: false, reason: 'early_exit' },
  );
}

{
  const h = harness([]);
  assert.deepEqual(
    await observeTelegramReadiness(h.options),
    { ok: false, reason: 'heartbeat_timeout' },
  );
}

{
  const root = mkdtempSync(join(tmpdir(), 'atlas-tg-readiness-'));
  const dataDir = join(root, 'data');
  const deadPid = 2_147_483_646;
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'atlas-telegram.pid'), String(deadPid));
  writeFileSync(join(dataDir, 'telegram.poll.lock'), String(deadPid));
  try {
    await cleanupFailedTelegramStart(root, deadPid);
    assert.equal(existsSync(join(dataDir, 'atlas-telegram.pid')), false);
    assert.equal(existsSync(join(dataDir, 'telegram.poll.lock')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log('telegram startup readiness tests: ok');
