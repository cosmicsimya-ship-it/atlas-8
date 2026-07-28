/**
 * Memory system runtime verification.
 * Run: node server/verify-memory-runtime.mjs
 */
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import {
  buildRelevantMemoryContext,
  detectMemoryIntent,
  processMemoryIntent,
} from './memory-intents.js';
import { buildChatUserPrompt } from './symbolic-synthesis.js';
import { buildAtlasChatRequest } from './atlas-chat-service.js';

// Use isolated temp memory file via dynamic import after patching is hard;
// tests use exported functions with unique user IDs on shared test file,
// then reset store at end.

import {
  createEmptyUserMemory,
  deleteUserMemory,
  getMemoryField,
  getMemoryFilePath,
  getUserMemory,
  isValidUserId,
  loadMemory,
  resetMemoryStoreForTests,
  saveMemory,
  setMemoryField,
  setUserMemory,
  telegramUserId,
  updateUserMemory,
  webUserId,
} from './user-memory.js';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(name, condition, detail = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

const WEB_USER_A = webUserId('test-session-a');
const WEB_USER_B = webUserId('test-session-b');
const TG_USER_A = telegramUserId('999001');
const TG_USER_B = telegramUserId('999002');

console.log('\n=== Memory storage tests ===\n');

await resetMemoryStoreForTests({ users: {} });

assert('valid web user id', isValidUserId(WEB_USER_A));
assert('valid telegram user id', isValidUserId(TG_USER_A));
assert('rejects invalid user id', !isValidUserId('invalid-user'));
assert('rejects mixed prefix', !isValidUserId('mixed:123'));

const firstSet = await setUserMemory(WEB_USER_A, createEmptyUserMemory());
assert('first memory creation', firstSet.ok === true);

const updated = await updateUserMemory(WEB_USER_A, {
  profile: { name: 'Dilek', birthDate: '15.03.1990' },
  facts: { hobby: 'Astroloji okumak' },
});
assert('update memory', updated.ok === true && updated.memory.profile.name === 'Dilek');

const readBack = getUserMemory(WEB_USER_A);
assert('read memory', readBack.profile.name === 'Dilek' && readBack.profile.birthDate === '15.03.1990');

const fieldVal = getMemoryField(WEB_USER_A, 'profile.name');
assert('get memory field', fieldVal === 'Dilek');

const fieldSet = await setMemoryField(WEB_USER_A, 'profile.location', 'İstanbul');
assert('set memory field', fieldSet.ok === true && fieldSet.memory.profile.location === 'İstanbul');

const missingUser = getUserMemory(webUserId('unknown-user-xyz'));
assert('missing user returns empty memory', missingUser.profile.name === null);

const tgSet = await updateUserMemory(TG_USER_A, { profile: { name: 'Telegram User' } });
assert('telegram user separation write', tgSet.ok === true);

const webName = getUserMemory(WEB_USER_A).profile.name;
const tgName = getUserMemory(TG_USER_A).profile.name;
assert('telegram/web separation', webName === 'Dilek' && tgName === 'Telegram User');

const webBSet = await updateUserMemory(WEB_USER_B, { profile: { name: 'Web B' } });
assert('web session separation', webBSet.ok === true && getUserMemory(WEB_USER_B).profile.name === 'Web B');

assert('loadMemory returns users object', typeof loadMemory().users === 'object');

// Duplicate writes
const dup1 = await updateUserMemory(WEB_USER_A, { profile: { timezone: 'Europe/Istanbul' } });
const dup2 = await updateUserMemory(WEB_USER_A, { profile: { timezone: 'Europe/Istanbul' } });
assert('duplicate writes succeed', dup1.ok && dup2.ok);

const deleteTarget = webUserId('delete-me');
await setUserMemory(deleteTarget, createEmptyUserMemory());
const deleted = await deleteUserMemory(deleteTarget);
assert('delete user memory', deleted.ok === true);
const afterDelete = getUserMemory(deleteTarget);
assert('deleted user returns empty memory', afterDelete.profile.name === null);

// Malformed JSON recovery
const memoryPath = getMemoryFilePath();
const backup = existsSync(memoryPath) ? readFileSync(memoryPath, 'utf-8') : null;
writeFileSync(memoryPath, '{ broken json !!!', 'utf-8');
const recovered = loadMemory();
assert('malformed JSON recovery', typeof recovered.users === 'object');

// Clean up recovery archives created by the test (not for repo)
const dataDir = dirname(memoryPath);
for (const name of readdirSync(dataDir)) {
  if (name.includes('.corrupt.')) {
    try {
      unlinkSync(join(dataDir, name));
    } catch {
      /* ignore */
    }
  }
}

if (backup !== null) {
  writeFileSync(memoryPath, backup, 'utf-8');
} else {
  await resetMemoryStoreForTests({ users: {} });
}

// Failed save simulation — invalid store rejected
const badSave = saveMemory(null);
assert('failed save rejected', badSave.ok === false);

console.log('\n=== Memory intent tests ===\n');

assert('detect save intent', detectMemoryIntent('Bunu hatırla: kedimin adı Pamuk').type === 'save');
assert('detect recall intent', detectMemoryIntent('Benim hakkımda ne biliyorsun?').type === 'recall');
assert('detect forget intent', detectMemoryIntent('Bunu unut').type === 'forget');
assert('detect profile birth date', detectMemoryIntent('Benim doğum tarihim 20.05.1988').type === 'profile-update');
assert('detect location profile', detectMemoryIntent('Konumum İstanbul').type === 'profile-update');

const recallUser = webUserId('recall-test');
await resetMemoryStoreForTests({ users: {} });
await updateUserMemory(recallUser, {
  profile: { name: 'Test', location: 'Ankara' },
});

const recallResult = await processMemoryIntent(recallUser, 'Benim hakkımda ne biliyorsun?', {
  type: 'recall',
});
assert(
  'recall returns stored data',
  recallResult.handled && recallResult.reply.includes('Ankara'),
);

const saveUser = webUserId('save-test');
await resetMemoryStoreForTests({ users: {} });
const saveResult = await processMemoryIntent(saveUser, 'Bunu hatırla: en sevdiğim renk mavi', {
  type: 'save',
});
assert(
  'save confirms after persistence',
  saveResult.handled && saveResult.memoryUpdated && saveResult.reply.includes('kaydettim'),
);

const savedFacts = Object.values(getUserMemory(saveUser).facts);
assert('saved fact persisted', savedFacts.some((v) => String(v).includes('mavi')));

const profileUser = webUserId('profile-test');
await resetMemoryStoreForTests({ users: {} });
const profileResult = await processMemoryIntent(
  profileUser,
  'Doğum tarihim 12.01.1995',
  { type: 'profile-update', detail: 'birthDate' },
);
assert(
  'profile update saved',
  profileResult.memoryUpdated && getUserMemory(profileUser).profile.birthDate === '12.01.1995',
);

const forgetUser = webUserId('forget-test');
await resetMemoryStoreForTests({ users: {} });
await updateUserMemory(forgetUser, { facts: { note_test: 'geçici not' } });
const forgetResult = await processMemoryIntent(forgetUser, 'Bunu unut: geçici not', { type: 'forget' });
assert('forget handled', forgetResult.handled === true);

console.log('\n=== Prompt injection tests ===\n');

const ctxUser = webUserId('context-test');
await resetMemoryStoreForTests({ users: {} });
await updateUserMemory(ctxUser, {
  profile: {
    name: 'Ayşe',
    birthDate: '01.01.2000',
    location: 'İzmir',
    timezone: 'Europe/Istanbul',
  },
});

const relevant = buildRelevantMemoryContext(ctxUser, 'numeroloji hesapla', 'meta-synthesis');
assert(
  'injects relevant fields only for meta',
  relevant.includes('Doğum tarihi') && relevant.includes('Ayşe'),
);

const irrelevant = buildRelevantMemoryContext(ctxUser, 'merhaba', 'conversational');
assert(
  'conversational injects minimal context',
  irrelevant.includes('Ayşe') && !irrelevant.includes('Doğum tarihi'),
);

const prompt = buildChatUserPrompt('test', [], 'meta-synthesis', null, relevant);
assert('memory context in user prompt', prompt.includes('## Kalıcı Kullanıcı Hafızası'));

const chatReq = buildAtlasChatRequest({
  message: 'numeroloji',
  memoryContext: relevant,
});
assert('chat request preserves memory context path', chatReq.userPrompt.includes('Kalıcı Kullanıcı Hafızası'));

console.log('\n=== Verification examples ===\n');

const examples = [
  { msg: 'Bunu hatırla: sabahları kahve içerim', expectSave: true },
  { msg: 'Doğum tarihim 03.07.1992', expectProfile: 'birthDate' },
  { msg: 'Konumum Berlin', expectProfile: 'location' },
];

const exampleUser = webUserId('example-flow');
await resetMemoryStoreForTests({ users: {} });

for (const ex of examples) {
  const intent = detectMemoryIntent(ex.msg);
  const result = await processMemoryIntent(exampleUser, ex.msg, intent);
  if (ex.expectSave) {
    assert(`example save: ${ex.msg.slice(0, 30)}`, result.memoryUpdated === true);
  }
  if (ex.expectProfile) {
    assert(`example profile: ${ex.msg.slice(0, 30)}`, result.memoryUpdated === true);
  }
}

const recallEx = await processMemoryIntent(exampleUser, 'Benim hakkımda ne biliyorsun?', {
  type: 'recall',
});
assert('example recall', recallEx.reply.includes('Berlin') || recallEx.reply.includes('1992'));

const forgetEx = await processMemoryIntent(exampleUser, 'Bunu unut', { type: 'forget' });
assert('example forget handled', forgetEx.handled === true);

// Cleanup test users
await resetMemoryStoreForTests({ users: {} });

console.log('\n=== Summary ===\n');
const failed = results.filter((r) => !r.ok);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length > 0) {
  console.log('\nFailures:');
  for (const f of failed) {
    console.log(`  - ${f.name}: ${f.detail}`);
  }
  process.exit(1);
}

console.log('\nAll memory verification tests passed.\n');
