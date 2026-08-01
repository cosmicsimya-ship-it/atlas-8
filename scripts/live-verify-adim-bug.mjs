/**
 * Live verify the "adım attığında" false memory-write bug against running backend.
 * Run: node scripts/live-verify-adim-bug.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import {
  getUserMemory,
  webUserId,
  updateUserMemory,
  resetMemoryStoreForTests,
} from '../server/user-memory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, '.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const FAILING =
  'Atlas insanlara iletişim için adım attığında neden normal insanlar gibi cevap vermezler, beni gözlerinde büyüttükleri için tribe mi giriyorlar yoksa tarafımdan seçilmiş olmak mı?';

const uid = webUserId('live-verify-adim');
await resetMemoryStoreForTests({ users: {} });
await updateUserMemory(uid, { profile: { name: 'Dilek' } });

const direct = await processAtlasMessage(
  {
    channel: 'telegram',
    userId: uid,
    conversationId: 'live-verify',
    message: FAILING,
    history: [],
  },
  { trustedUserId: uid, mode: 'conversational' },
);

console.log(
  'DIRECT',
  JSON.stringify(
    {
      engine: direct.engine,
      intent: direct.intent,
      memoryUpdated: direct.memoryUpdated,
      memoryHandled: direct.data?.memoryHandled,
      hasKaydettim: String(direct.reply || '').includes('Ad bilgini kaydettim'),
      name: getUserMemory(uid).profile.name,
      replyStart: String(direct.reply || '').slice(0, 100),
    },
    null,
    2,
  ),
);

const secret = process.env.ATLAS_INTERNAL_BOT_SECRET || '';
const res = await fetch('http://127.0.0.1:3001/api/atlas/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Atlas-Bot-Secret': secret,
  },
  body: JSON.stringify({
    channel: 'telegram',
    userId: 'telegram:999888777',
    conversationId: '999888777',
    message: FAILING,
    history: [],
    metadata: { telegramFromId: '999888777' },
  }),
});
const json = await res.json();
console.log(
  'HTTP',
  res.status,
  JSON.stringify(
    {
      engine: json.engine,
      intent: json.intent,
      memoryUpdated: json.memoryUpdated,
      memoryHandled: json.data?.memoryHandled,
      hasKaydettim: String(json.reply || '').includes('Ad bilgini kaydettim'),
      replyStart: String(json.reply || '').slice(0, 120),
    },
    null,
    2,
  ),
);

const ok =
  !String(direct.reply || '').includes('Ad bilgini kaydettim') &&
  direct.engine !== 'memory' &&
  getUserMemory(uid).profile.name === 'Dilek' &&
  !String(json.reply || '').includes('Ad bilgini kaydettim') &&
  json.engine !== 'memory';

if (!ok) {
  console.error('LIVE VERIFY FAILED');
  process.exit(1);
}
console.log('LIVE VERIFY PASSED');
