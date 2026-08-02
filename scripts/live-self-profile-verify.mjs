/**
 * Live self-profile matrix via processAtlasMessage (+ optional HTTP).
 * Seeds verify fixtures under Lara keys; does not commit.
 * Run: node scripts/live-self-profile-verify.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { updateUserMemory, getUserMemory } from '../server/user-memory.js';
import { resetActivationSessionsForTests } from '../server/conversation-activation.js';

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

const LARA_TG = 'telegram:7142880605';
const FIXTURE = {
  profile: {
    name: 'Lara',
    birthDate: '1990-01-15',
    birthTime: '14:30',
    birthPlace: 'İstanbul',
  },
  facts: {
    zodiac: 'Kova',
    rising: 'Terazi',
    lifePath: '8',
    ebced: '212',
  },
};

const matrix = [
  ['Benim burcum ne?', /Kova/i],
  ['Benim yaşım kaç?', /36|yaşındasın/i],
  ['Doğum tarihim ne?', /1990-01-15/],
  ['Doğum saatim ne?', /14:30/],
  ['Nerede doğdum?', /İstanbul/i],
  ['Yükselenim ne?', /Terazi/i],
  ['Numerolojim ne?', /\b8\b/],
  ['Ebcedim ne?', /212/],
];

console.log('\n=== Live self-profile verify ===\n');

await updateUserMemory(LARA_TG, FIXTURE);
await updateUserMemory('web:founder', FIXTURE);
console.log('seeded', LARA_TG, JSON.stringify({
  profile: getUserMemory(LARA_TG)?.profile,
  facts: getUserMemory(LARA_TG)?.facts,
}, null, 2));

let fail = 0;
let i = 0;
for (const [message, re] of matrix) {
  resetActivationSessionsForTests();
  i += 1;
  const r = await processAtlasMessage(
    {
      message,
      userId: LARA_TG,
      displayName: 'Lara',
      channel: 'telegram',
      conversationId: `live-self-profile-verify-${i}`,
      history: [],
      metadata: {
        isGroup: true,
        telegramFromId: 7142880605,
        addressedToBot: true,
      },
    },
    { trustedUserId: LARA_TG, roles: ['user'], atlasBotVerified: true },
  );
  const engine = r.data?.engine ?? r.engine;
  const intent = r.data?.intent ?? r.intent;
  const reply = String(r.reply || '');
  const ok =
    /conversation-context/i.test(String(engine)) &&
    /self_profile/i.test(String(intent)) &&
    re.test(reply);
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  console.log(`  engine=${engine} intent=${intent}`);
  console.log(`  reply=${reply.slice(0, 180)}`);
  if (!ok) fail += 1;
}

// Missing-data rising honesty on disposable user (no ascendant engine)
const NORISE = 'telegram:7142889999';
await updateUserMemory(NORISE, {
  profile: {
    name: 'NoRise',
    birthDate: '1990-01-15',
    birthTime: '10:00',
    birthPlace: 'Ankara',
  },
  facts: { zodiac: 'Kova' },
});
{
  resetActivationSessionsForTests();
  const r = await processAtlasMessage(
    {
      message: 'Yükselenim ne?',
      userId: NORISE,
      displayName: 'NoRise',
      channel: 'telegram',
      conversationId: 'live-self-profile-rising-missing',
      history: [],
      metadata: {
        isGroup: true,
        telegramFromId: 7142889999,
        addressedToBot: true,
      },
    },
    { trustedUserId: NORISE, roles: ['user'], atlasBotVerified: true },
  );
  const reply = String(r.reply || '');
  const ok =
    /conversation-context/i.test(String(r.engine ?? r.data?.engine)) &&
    /kayıtlı değil|yükselen hesabı/i.test(reply) &&
    !/Doğum tarihini verirsen hesaplayabilirim/i.test(reply);
  console.log(`${ok ? '✓' : '✗'} rising missing honest`);
  console.log(`  reply=${reply.slice(0, 180)}`);
  if (!ok) fail += 1;
}

// Isolation
{
  resetActivationSessionsForTests();
  const r = await processAtlasMessage(
    {
      message: 'Benim burcum ne?',
      userId: 'telegram:9999999999',
      displayName: 'Other',
      channel: 'telegram',
      conversationId: 'live-self-profile-iso',
      history: [],
      metadata: {
        isGroup: true,
        telegramFromId: 9999999999,
        addressedToBot: true,
      },
    },
    { trustedUserId: 'telegram:9999999999', roles: ['user'], atlasBotVerified: true },
  );
  const reply = String(r.reply || '');
  const ok = !/Kova/i.test(reply);
  console.log(`${ok ? '✓' : '✗'} isolation other user`);
  console.log(`  reply=${reply.slice(0, 180)}`);
  if (!ok) fail += 1;
}

// Restore Lara fixture for Telegram runtime
await updateUserMemory(LARA_TG, FIXTURE);
await updateUserMemory('web:founder', FIXTURE);

const secret = process.env.ATLAS_INTERNAL_BOT_SECRET || '';
const base = process.env.ATLAS_BACKEND_URL || 'http://127.0.0.1:3001';
if (secret) {
  console.log('\n--- HTTP bot-secret path ---');
  for (const [message, re] of matrix) {
    try {
      const res = await fetch(`${base}/api/atlas/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Atlas-Bot-Secret': secret,
        },
        body: JSON.stringify({
          message,
          userId: LARA_TG,
          displayName: 'Lara',
          channel: 'telegram',
          conversationId: `http-self-profile-verify-${message.length}`,
          history: [],
          metadata: {
            isGroup: true,
            telegramFromId: '7142880605',
            addressedToBot: true,
          },
        }),
      });
      const body = await res.json();
      const reply = String(body.reply || body.data?.reply || '');
      const engine = body.engine ?? body.data?.engine;
      const intent = body.intent ?? body.data?.intent ?? body.data?.conversationIntent;
      const dbg = body.data?.selfProfileDebug;
      const ok =
        res.ok &&
        /conversation-context/i.test(String(engine)) &&
        re.test(reply);
      console.log(`${ok ? '✓' : '✗'} HTTP ${message}`);
      console.log(`  status=${res.status} engine=${engine} intent=${intent}`);
      if (dbg) console.log(`  debug=${JSON.stringify(dbg)}`);
      console.log(`  reply=${reply.slice(0, 180)}`);
      if (!ok) fail += 1;
    } catch (err) {
      console.log(`✗ HTTP ${message} — ${err.message}`);
      fail += 1;
    }
  }
} else {
  console.log('\n(skip HTTP — ATLAS_INTERNAL_BOT_SECRET unset)');
}

console.log(`\n=== ${fail === 0 ? 'PASS' : 'FAIL'} (${fail} failed) ===\n`);
process.exit(fail === 0 ? 0 : 1);
