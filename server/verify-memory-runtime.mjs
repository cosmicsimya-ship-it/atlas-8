/**
 * Memory system runtime verification.
 * Run: node server/verify-memory-runtime.mjs
 */
import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import {
  buildRelevantMemoryContext,
  detectMemoryIntent,
  extractValidatedMemoryEntity,
  isPlausiblePersonName,
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

function memoryFileHash() {
  const path = getMemoryFilePath();
  if (!existsSync(path)) return 'missing';
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

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
assert(
  'birth date without write verb is ignored',
  detectMemoryIntent('Benim doğum tarihim 20.05.1988').type === null,
);
assert(
  'location without write verb is ignored',
  detectMemoryIntent('Konumum İstanbul').type === null,
);
assert(
  'detect profile birth date with write verb',
  detectMemoryIntent('Benim doğum tarihim 20.05.1988, belleğine ekle').type === 'profile-update' &&
    detectMemoryIntent('Benim doğum tarihim 20.05.1988, belleğine ekle').detail === 'birthDate',
);
assert(
  'detect location profile with write verb',
  detectMemoryIntent('Konumum İstanbul, kaydet').type === 'profile-update' &&
    detectMemoryIntent('Konumum İstanbul, kaydet').detail === 'location',
);

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
  'Doğum tarihim 12.01.1995, kaydet',
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

const prompt = buildChatUserPrompt('test', [], 'meta-synthesis', null, {
  userMemoryContext: relevant,
});
assert('memory context in user prompt', prompt.includes('## Kişisel Profil Hafızası'));

const chatReq = buildAtlasChatRequest({
  message: 'numeroloji',
  memoryContext: relevant,
});
assert('chat request preserves memory context path', chatReq.userPrompt.includes('Kişisel Profil Hafızası'));

console.log('\n=== Verification examples ===\n');

const examples = [
  { msg: 'Bunu hatırla: sabahları kahve içerim', expectSave: true },
  { msg: 'Doğum tarihim 03.07.1992, belleğine ekle', expectProfile: 'birthDate' },
  { msg: 'Konumum Berlin, kaydet', expectProfile: 'location' },
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

console.log('\n=== Strict name / false-positive guards ===\n');

const mustNotWrite = [
  'Atlas insanlara iletişim için adım attığında neden cevap vermezler?',
  'Bugün önemli bir adım attım.',
  'Adalet hakkında ne düşünüyorsun?',
  'Beni hatırlıyor musun?',
  'Atlas, bu kişi neden böyle davranıyor?',
  'Adım adım anlat.',
  'Bu bilgiyi kaydetme.',
  'Atlas insanlara iletişim için adım attığında neden normal insanlar gibi cevap vermezler, beni gözlerinde büyüttükleri için tribe mi giriyorlar yoksa tarafımdan seçilmiş olmak mı?',
];

for (const msg of mustNotWrite) {
  const intent = detectMemoryIntent(msg);
  const entity = intent.type ? extractValidatedMemoryEntity(msg, intent) : null;
  assert(
    `no false memory intent: ${msg.slice(0, 42)}`,
    intent.type === null && entity === null,
  );
}

assert('rejects sentence-like name', !isPlausiblePersonName('attığında neden normal insanlar gibi cevap vermezler'));
assert('rejects question name', !isPlausiblePersonName('ne?'));
assert('rejects verbish name', !isPlausiblePersonName('attığında'));
assert('accepts person name', isPlausiblePersonName('Lara'));
assert('accepts two-part name', isPlausiblePersonName('Ayşe Nur'));

const mustWrite = [
  {
    msg: 'Adım Lara, kaydet.',
    expect: { type: 'profile-update', field: 'name', value: 'Lara', memoryUpdated: true },
  },
  {
    msg: 'Bundan sonra bana Lara de.',
    expect: { type: 'profile-update', field: 'name', value: 'Lara', memoryUpdated: false, clarity: 'ambiguous' },
  },
  {
    msg: 'Benim adımı Lara olarak hatırla.',
    expect: { type: 'profile-update', field: 'name', value: 'Lara', memoryUpdated: true },
  },
  {
    msg: 'Doğum tarihim 8 Kasım, belleğine ekle.',
    expect: { type: 'profile-update', field: 'birthDate', value: '8 Kasım', memoryUpdated: true },
  },
];

const strictUser = webUserId('strict-name-test');
await resetMemoryStoreForTests({ users: {} });

for (const item of mustWrite) {
  const intent = detectMemoryIntent(item.msg);
  const entity = extractValidatedMemoryEntity(item.msg, intent);
  const result = await processMemoryIntent(strictUser, item.msg, intent);
  const expectWrite = item.expect.memoryUpdated !== false;
  assert(
    `${expectWrite ? 'writes' : 'confirms before write'} on request: ${item.msg}`,
    intent.type === item.expect.type &&
      (item.expect.clarity ? intent.clarity === item.expect.clarity : true) &&
      entity?.kind === 'profile' &&
      entity.field === item.expect.field &&
      entity.value === item.expect.value &&
      result.memoryUpdated === expectWrite &&
      !result.reply.includes('Ad bilgini kaydettim: attığında'),
  );
}

await updateUserMemory(strictUser, { profile: { name: 'Lara' } });
const forgetNameIntent = detectMemoryIntent('Adımı unut.');
const forgetNameResult = await processMemoryIntent(strictUser, 'Adımı unut.', forgetNameIntent);
assert(
  'forgets name on explicit request',
  forgetNameIntent.type === 'forget' &&
    forgetNameResult.memoryUpdated === true &&
    getUserMemory(strictUser).profile.name === null,
);

assert(
  'stage2 blocks write without valid entity',
  extractValidatedMemoryEntity('kaydet', { type: 'save' }) === null,
);

console.log('\n=== Regression: normal chat must not mutate memory ===\n');

const regressionUser = webUserId('regression-chat');
await resetMemoryStoreForTests({ users: {} });
const seeded = await updateUserMemory(regressionUser, { profile: { name: 'Dilek' } });
assert('regression: seed profile.name', seeded.ok === true && getUserMemory(regressionUser).profile.name === 'Dilek');

const beforeHash = memoryFileHash();
const beforeName = getUserMemory(regressionUser).profile.name;
const chatMsg =
  'Atlas insanlara iletişim için adım attığında neden normal insanlar gibi cevap vermezler, beni gözlerinde büyüttükleri için tribe mi giriyorlar yoksa tarafımdan seçilmiş olmak mı?';
const chatIntent = detectMemoryIntent(chatMsg);
const chatEntity = chatIntent.type ? extractValidatedMemoryEntity(chatMsg, chatIntent) : null;
const chatResult = chatIntent.type
  ? await processMemoryIntent(regressionUser, chatMsg, chatIntent)
  : { handled: false, memoryUpdated: false, reply: '' };
const afterHash = memoryFileHash();
const afterName = getUserMemory(regressionUser).profile.name;

assert('regression: no memory intent on normal chat', chatIntent.type === null);
assert('regression: no validated entity', chatEntity === null);
assert('regression: memory file hash unchanged', beforeHash === afterHash, `${beforeHash.slice(0, 12)} → ${afterHash.slice(0, 12)}`);
assert(
  'regression: profile.name unchanged',
  beforeName === 'Dilek' && afterName === 'Dilek',
  `before=${beforeName} after=${afterName}`,
);
assert('regression: memory engine not engaged', chatResult.handled !== true && chatResult.memoryUpdated !== true);
assert(
  'regression: no save confirmation reply',
  !String(chatResult.reply ?? '').includes('Ad bilgini kaydettim'),
);

console.log('\n=== Pipeline e2e: exact failing sentence must not hit memory writer ===\n');

const FAILING_SENTENCE =
  'Atlas insanlara iletişim için adım attığında neden normal insanlar gibi cevap vermezler, beni gözlerinde büyüttükleri için tribe mi giriyorlar yoksa tarafımdan seçilmiş olmak mı?';

{
  const { processAtlasMessage } = await import('./atlas-message-service.js');
  const e2eUser = webUserId('e2e-failing-sentence');
  await resetMemoryStoreForTests({ users: {} });
  await updateUserMemory(e2eUser, { profile: { name: 'Dilek' } });
  const before = getUserMemory(e2eUser).profile.name;
  const beforeHash = memoryFileHash();

  const e2e = await processAtlasMessage(
    {
      channel: 'web',
      userId: e2eUser,
      conversationId: 'e2e-failing-sentence',
      message: FAILING_SENTENCE,
      history: [],
    },
    { mode: 'conversational', trustedUserId: e2eUser },
  );

  const after = getUserMemory(e2eUser).profile.name;
  const afterHash = memoryFileHash();

  assert('e2e: intent is not memory', !String(e2e.intent ?? '').startsWith('memory:'));
  assert('e2e: engine is not memory', e2e.engine !== 'memory');
  assert('e2e: memoryUpdated is false', e2e.memoryUpdated !== true);
  assert('e2e: memoryHandled is not true', e2e.data?.memoryHandled !== true);
  assert(
    'e2e: reply is not save confirmation',
    !String(e2e.reply ?? '').includes('Ad bilgini kaydettim'),
  );
  assert('e2e: profile.name unchanged', before === 'Dilek' && after === 'Dilek');
  assert('e2e: memory file hash unchanged', beforeHash === afterHash);

  // Positive control through the same pipeline gate (avoid founder-name "Lara")
  const saveE2e = await processAtlasMessage(
    {
      channel: 'web',
      userId: e2eUser,
      conversationId: 'e2e-failing-sentence',
      message: 'Adım Zeynep, kaydet.',
      history: [],
    },
    { mode: 'conversational', trustedUserId: e2eUser },
  );
  assert(
    'e2e positive: explicit name save works',
    saveE2e.engine === 'memory' &&
      saveE2e.memoryUpdated === true &&
      getUserMemory(e2eUser).profile.name === 'Zeynep' &&
      String(saveE2e.reply).includes('Ad bilgini kaydettim: Zeynep'),
    `engine=${saveE2e.engine} updated=${saveE2e.memoryUpdated} name=${getUserMemory(e2eUser).profile.name} reply=${String(saveE2e.reply).slice(0, 80)}`,
  );
}

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
