/**
 * ATLAS LAB — remaining regression checks not already covered by
 * test-atlas-lab-trace-store.mjs / test-atlas-lab-admin-routes.mjs:
 *   1. trace generation never alters the actual response
 *   2. a real trace-store WRITE failure never breaks the response
 * Run: node scripts/test-atlas-lab-regression.mjs
 *
 * (Trimmed clean-port note: the observational evaluator is intentionally
 * excluded from this port, so its structural-isolation checks are dropped.)
 */
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { configureAtlasLabTraceStore } from '../server/atlas-lab/trace-store.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { _resetAllNumerologySessions } from '../server/numerology-engine/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];
function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function stripVolatile(result) {
  const clone = JSON.parse(JSON.stringify(result));
  if (clone?.data) {
    delete clone.data.requestTiming;
    delete clone.data.latencyMs;
  }
  return clone;
}

// ── 1. Trace generation must never alter the actual response ───────────
{
  _resetAllNumerologySessions();
  process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
  process.env.ATLAS_LAB_TRACES_DISABLED = '1';
  const withoutTracing = await processAtlasMessage(
    {
      message: '27.01.1986 numeroloji analizi yap',
      channel: 'web',
      conversationId: 'atlas-lab-regression-a',
      userId: 'web:atlas-lab-regression-a',
      history: [],
    },
    { trustedUserId: 'web:atlas-lab-regression-a' },
  );
  delete process.env.ATLAS_LAB_TRACES_DISABLED;

  _resetAllNumerologySessions();
  const withTracing = await processAtlasMessage(
    {
      message: '27.01.1986 numeroloji analizi yap',
      channel: 'web',
      conversationId: 'atlas-lab-regression-b',
      userId: 'web:atlas-lab-regression-b',
      history: [],
    },
    { trustedUserId: 'web:atlas-lab-regression-b' },
  );

  const a = stripVolatile(withoutTracing);
  const b = stripVolatile(withTracing);
  record('same reply text with tracing disabled vs enabled', a.reply === b.reply);
  record('same status with tracing disabled vs enabled', a.status === b.status);
  record('same engine/intent with tracing disabled vs enabled', a.engine === b.engine && a.intent === b.intent);
}

// ── 2. A real trace-store WRITE failure must never break the response ──
{
  // Point the store at a path where a *file* (not a directory) occupies a
  // path segment the store needs to mkdir into — a genuine, reproducible
  // filesystem failure (ENOTDIR), not just a bad-input short-circuit.
  const blockerFile = join(REPO_ROOT, 'data', '_atlas_lab_regression_blocker_file');
  const { writeFileSync, existsSync, mkdirSync, rmSync } = await import('fs');
  if (!existsSync(join(REPO_ROOT, 'data'))) mkdirSync(join(REPO_ROOT, 'data'), { recursive: true });
  writeFileSync(blockerFile, 'x');
  configureAtlasLabTraceStore(join(blockerFile, 'traces.json')); // blockerFile is a FILE, not a dir

  _resetAllNumerologySessions();
  let threw = false;
  let result = null;
  try {
    result = await processAtlasMessage(
      {
        message: '27.01.1986 numeroloji analizi yap',
        channel: 'web',
        conversationId: 'atlas-lab-regression-failstore',
        userId: 'web:atlas-lab-regression-failstore',
        history: [],
      },
      { trustedUserId: 'web:atlas-lab-regression-failstore' },
    );
  } catch {
    threw = true;
  }
  record('processAtlasMessage does not throw when the trace store cannot write', threw === false);
  record('response still completes successfully despite the trace-store failure', result?.engine === 'numerology-engine');

  rmSync(blockerFile, { force: true });
  configureAtlasLabTraceStore(); // restore default
}

console.log('');
console.log(`ATLAS LAB regression tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error('Failures:', failures.join('; '));
  process.exit(1);
}
