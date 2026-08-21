#!/usr/bin/env node
/**
 * Safe smoke: create → retrieve → contradict → forget → cleanup
 * Uses temp DB + temp JSON. Never touches production data/.
 *
 *   npm run memory:smoke
 */
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const id = randomUUID();
process.env.MEMORY_V2_ENABLED = '1';
process.env.MEMORY_V2_DUAL_WRITE = '1';
process.env.ATLAS_MEMORY_V2_DB = join(tmpdir(), `atlas-mem-smoke-${id}.sqlite`);
process.env.ATLAS_MEMORY_FILE = join(tmpdir(), `atlas-mem-smoke-${id}.json`);
process.env.ATLAS_ALLOW_MEMORY_RESET = '1';

const { resetMemoryV2StoreForTests, closeMemoryDb, findActiveByKey, retrieveRelevantMemories } =
  await import('./index.js');
const { processMemoryIntent, detectMemoryIntent } = await import('../memory-intents.js');
const { webUserId, getUserMemory } = await import('../user-memory.js');
const { readFileSync, existsSync } = await import('fs');

await resetMemoryV2StoreForTests({ force: true });
const user = webUserId(`smoke-${id.slice(0, 8)}`);

function intent(msg) {
  return detectMemoryIntent(msg);
}

let step = 'create';
await processMemoryIntent(
  user,
  'Bunu hatırla: Kahvemi şekersiz içerim.',
  intent('Bunu hatırla: Kahvemi şekersiz içerim.'),
);
if (findActiveByKey(user, 'preference.coffee.sugar')?.value !== false) {
  throw new Error('create failed');
}

step = 'retrieve';
const r1 = retrieveRelevantMemories({ userId: user, message: 'Sabah rutini hazırla' });
if (!r1.memories.some((m) => m.key === 'preference.coffee.sugar')) {
  throw new Error('retrieve failed');
}

step = 'contradict';
await processMemoryIntent(
  user,
  'Bunu hatırla: Artık kahvemi şekerli içiyorum.',
  intent('Bunu hatırla: Artık kahvemi şekerli içiyorum.'),
);
if (findActiveByKey(user, 'preference.coffee.sugar')?.value !== true) {
  throw new Error('contradict failed');
}

step = 'dual-write';
const json = JSON.parse(readFileSync(process.env.ATLAS_MEMORY_FILE, 'utf-8'));
if (!json.users?.[user]) throw new Error('dual-write missing user');

step = 'forget';
await processMemoryIntent(
  user,
  'Kahve tercihimle ilgili bilgiyi unut.',
  intent('Kahve tercihimle ilgili bilgiyi unut.'),
);
if (findActiveByKey(user, 'preference.coffee.sugar')) {
  throw new Error('forget failed');
}

step = 'cleanup';
closeMemoryDb();
void getUserMemory;
void existsSync;

console.log(JSON.stringify({ ok: true, user, steps: ['create', 'retrieve', 'contradict', 'dual-write', 'forget', 'cleanup'] }));
