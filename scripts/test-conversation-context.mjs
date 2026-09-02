/**
 * Conversation context engine — multi-turn Telegram group fixtures.
 * Run: node scripts/test-conversation-context.mjs
 */
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
import { join } from 'path';
import { tmpdir } from 'os';
process.env.ATLAS_MEMORY_FILE = join(
  tmpdir(),
  `atlas-user-memory-context-test-${process.pid}.json`,
);

import {
  analyzeIdentityClaim,
} from '../server/identity-claims.js';
import {
  detectConversationIntent,
  tryDeterministicConversationReply,
} from '../server/atlas-conversation-style.js';
import { classifyPrivacyIntent } from '../server/privacy/privacy-classifier.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import {
  resetConversationState,
  seedParticipantFact,
  tryResolveConversationContext,
  detectProfilePropertyQuery,
  detectSelfProfileQuery,
  classifyResponseMode,
  applyRepetitionGuard,
  getConversationState,
  noteAssistantTurn,
  validateAndBindParticipantFact,
  canonicalizeZodiac,
  isPresenceUtterance,
  ageFromBirthDate,
  normalizeUserProfileFacts,
  CONVERSATION_CONTEXT_VERSION,
} from '../server/conversation-context-engine.js';
import { getUserMemory, updateUserMemory } from '../server/user-memory.js';

const FURKAN = {
  userId: 'telegram:900001',
  displayName: 'Furkan',
};
const LARA = {
  userId: 'telegram:900002',
  displayName: 'Lara',
};

const results = [];

function record(label, pass, detail = '') {
  results.push({ label, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function assert(label, cond, detail = '') {
  record(label, Boolean(cond), cond ? '' : detail || 'failed');
}

async function msg(conversationId, speaker, text, history = []) {
  return processAtlasMessage(
    {
      message: text,
      userId: speaker.userId,
      displayName: speaker.displayName,
      channel: 'telegram',
      conversationId,
      history,
      metadata: {
        isGroup: true,
        telegramFromId: Number(speaker.userId.replace('telegram:', '')),
        addressedToBot: true,
        replyToBot: false,
      },
    },
    { trustedUserId: speaker.userId, roles: ['user'] },
  );
}

console.log(`\n=== Conversation Context Engine ${CONVERSATION_CONTEXT_VERSION} ===\n`);

// ── Unit: self-profile resolution ──
console.log('\n--- Self-profile resolution ---');
{
  assert(
    'self detect burcum',
    detectSelfProfileQuery('Benim burcum ne?')?.field === 'zodiac',
  );
  assert(
    'self detect yaşım',
    detectSelfProfileQuery('Benim yaşım kaç?')?.field === 'age',
  );
  assert(
    'self detect doğum',
    detectSelfProfileQuery('Benim doğum tarihim ne?')?.field === 'birthDate',
  );
  assert(
    'self detect yükselen',
    detectSelfProfileQuery('Benim yükselenim ne?')?.field === 'rising',
  );
  assert(
    'self detect numeroloji',
    detectSelfProfileQuery('Benim numerolojim ne?')?.field === 'numerology',
  );
  assert(
    'self detect ebced',
    detectSelfProfileQuery('Benim ebcedim ne?')?.field === 'abjad',
  );
  assert(
    'self detect doğum saati',
    detectSelfProfileQuery('Doğum saatim ne?')?.field === 'birthTime',
  );
  assert(
    'self detect nerede doğdum',
    detectSelfProfileQuery('Nerede doğdum?')?.field === 'birthPlace',
  );
  assert(
    'self detect yükselen bare',
    detectSelfProfileQuery('Yükselenim ne?')?.field === 'rising',
  );
  assert('self not third-party', detectSelfProfileQuery('Lara senin burcun nedir?') == null);

  // Istanbul age: birthday later in year → age-1
  assert(
    'age istanbul before birthday',
    ageFromBirthDate('1990-12-31', new Date('2026-08-01T12:00:00+03:00')) === 35,
  );
  assert(
    'age istanbul after birthday',
    ageFromBirthDate('1990-01-10', new Date('2026-08-01T12:00:00+03:00')) === 36,
  );

  // Normalize schema aliases
  {
    const n = normalizeUserProfileFacts({
      profile: { birthDate: null },
      facts: {
        birthDate: '1991-02-03',
        risingSign: 'Koç',
        lifePath: '7',
        ebced: '88',
      },
    });
    assert('normalize facts.birthDate', n.birthDate === '1991-02-03');
    assert('normalize risingSign', n.rising === 'Koç');
    assert('normalize lifePath', n.numerology === '7');
    assert('normalize ebced', n.abjad === '88');
  }

  const FULL = { userId: 'telegram:900088', displayName: 'Profil' };
  await updateUserMemory(FULL.userId, {
    profile: {
      name: 'Profil',
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
  });
  resetConversationState('self-matrix');
  const matrix = [
    ['Benim burcum ne?', /Kova/],
    ['Benim yaşım kaç?', /yaşındasın/],
    ['Doğum tarihim ne?', /1990-01-15/],
    ['Doğum saatim ne?', /14:30/],
    ['Nerede doğdum?', /İstanbul/],
    ['Yükselenim ne?', /Terazi/],
    ['Numerolojim ne?', /8/],
    ['Ebcedim ne?', /212/],
  ];
  for (const [msg, re] of matrix) {
    const out = tryResolveConversationContext({
      conversationId: 'self-matrix',
      message: msg,
      sender: FULL,
    });
    assert(
      `matrix ${msg}`,
      out.handled && out.engine === 'conversation-context' && re.test(out.reply),
      out.reply,
    );
  }

  // Isolation: other user must not see FULL's facts
  const OTHER = { userId: 'telegram:900077', displayName: 'Başka' };
  resetConversationState('self-iso');
  const iso = tryResolveConversationContext({
    conversationId: 'self-iso',
    message: 'Benim burcum ne?',
    sender: OTHER,
  });
  assert(
    'isolation no cross-user zodiac',
    iso.handled && !/Kova/i.test(iso.reply),
    iso.reply,
  );

  // Rising with complete birth data → deterministic natal engine (not invented prose)
  const NORISE = { userId: 'telegram:900066', displayName: 'Rise' };
  await updateUserMemory(NORISE.userId, {
    profile: { birthDate: '1990-01-15', birthTime: '10:00', birthPlace: 'Ankara' },
    facts: {},
  });
  resetConversationState('self-norise');
  const nr = tryResolveConversationContext({
    conversationId: 'self-norise',
    message: 'Yükselenim ne?',
    sender: NORISE,
  });
  assert(
    'rising from natal engine',
    nr.handled &&
      /Doğum bilgilerine göre yükselenin/i.test(nr.reply) &&
      /\d°/.test(nr.reply) &&
      !/tahmini olarak yükselen/i.test(nr.reply),
    nr.reply,
  );

  // Rising without birth time → honest ask (never invent)
  const NOTIME = { userId: 'telegram:900067', displayName: 'NoTime' };
  await updateUserMemory(NOTIME.userId, {
    profile: { birthDate: '1990-01-15', birthPlace: 'Ankara' },
    facts: {},
  });
  resetConversationState('self-notime-rise');
  const nt = tryResolveConversationContext({
    conversationId: 'self-notime-rise',
    message: 'Yükselenim ne?',
    sender: NOTIME,
  });
  assert(
    'rising missing time honest',
    nt.handled &&
      /doğum saati/i.test(nt.reply) &&
      !/tahmini olarak yükselen/i.test(nt.reply) &&
      !/Doğum tarihini verirsen hesaplayabilirim/i.test(nt.reply),
    nt.reply,
  );

  // Numerology derived from birthDate; ebced never from birthDate/name alone
  const NUM = { userId: 'telegram:900055', displayName: 'Numa' };
  await updateUserMemory(NUM.userId, {
    profile: { name: 'Numa', birthDate: '1990-01-15' },
    facts: {},
  });
  resetConversationState('self-num');
  const nOut = tryResolveConversationContext({
    conversationId: 'self-num',
    message: 'Numerolojim ne?',
    sender: NUM,
  });
  assert(
    'numerology derived life path',
    nOut.handled && /yaşam yolu|numeroloj/i.test(nOut.reply) && /\d/.test(nOut.reply),
    nOut.reply,
  );
  const aOut = tryResolveConversationContext({
    conversationId: 'self-num',
    message: 'Ebcedim ne?',
    sender: NUM,
  });
  assert(
    'ebced no invent from name/birth',
    aOut.handled && /ebced|metodoloji|Arapça/i.test(aOut.reply) && !/^\d+$/.test(aOut.reply.trim()),
    aOut.reply,
  );

  resetConversationState('self-zodiac-mem');
  await updateUserMemory(LARA.userId, { facts: { zodiac: 'Kova' } });
  const r = tryResolveConversationContext({
    conversationId: 'self-zodiac-mem',
    message: 'Benim burcum ne?',
    sender: LARA,
  });
  assert(
    'self zodiac from memory',
    r.handled && /Kova/i.test(r.reply) && !/Doğum tarihini/i.test(r.reply),
    r.reply,
  );
  assert('self zodiac intent', r.intent === 'context:self_profile_query');

  resetConversationState('self-zodiac-derived');
  await updateUserMemory(FURKAN.userId, {
    facts: { zodiac: null },
    profile: { birthDate: '1990-07-26' },
  });
  // Clear zodiac fact if update merges oddly — force via facts omit
  const furMem = getUserMemory(FURKAN.userId);
  if (furMem?.facts?.zodiac) {
    await updateUserMemory(FURKAN.userId, { facts: { zodiac: '' } });
  }
  // Use a fresh user to avoid leftover facts
  const DERIVED = { userId: 'telegram:900099', displayName: 'Deniz' };
  await updateUserMemory(DERIVED.userId, { profile: { birthDate: '1990-07-26' } });
  const r2 = tryResolveConversationContext({
    conversationId: 'self-zodiac-derived',
    message: 'Benim burcum ne?',
    sender: DERIVED,
  });
  assert(
    'self zodiac from birthDate',
    r2.handled && /Aslan/i.test(r2.reply),
    r2.reply,
  );

  resetConversationState('self-zodiac-missing');
  const MISSING = { userId: 'telegram:900098', displayName: 'Yeni' };
  const r3 = tryResolveConversationContext({
    conversationId: 'self-zodiac-missing',
    message: 'Benim burcum ne?',
    sender: MISSING,
  });
  assert(
    'self zodiac missing asks birth',
    r3.handled && /Doğum tarihini/i.test(r3.reply) && !/hitap/i.test(r3.reply),
    r3.reply,
  );

  const e2e = await msg('self-e2e', LARA, 'Benim burcum ne?');
  assert(
    'self e2e processAtlasMessage',
    /Kova/i.test(e2e.reply) && e2e.engine === 'conversation-context',
    `${e2e.engine} | ${e2e.reply}`,
  );
}

assert('presence: Ordamısın', isPresenceUtterance('Ordamısın'));
assert('presence: Burada mısın?', isPresenceUtterance('Burada mısın?'));
assert('presence intent → ping', detectConversationIntent('Ordamısın') === 'ping');
assert(
  'presence not identity',
  analyzeIdentityClaim('Ordamısın').kind === 'none',
);
{
  resetConversationState('t-presence');
  const r = tryResolveConversationContext({
    conversationId: 't-presence',
    message: 'Ordamısın',
    sender: FURKAN,
  });
  assert('presence reply', r.handled && r.reply === 'Buradayım.', r.reply);
  assert('presence mode', r.responseMode === 'presence');
  assert('presence forbidden hitap', !/hitap/i.test(r.reply || ''));
}

// ── Unit: property query ──
console.log('\n--- Profile property query ---');
{
  const q = detectProfilePropertyQuery('Lara senin burcun nedir?');
  assert('property detect field', q?.field === 'zodiac');
  assert('property detect subject', /lara/i.test(q?.subjectDisplayName || ''));
  assert(
    'property not public_profile',
    classifyPrivacyIntent('Lara senin burcun nedir?').requestType === 'profile_property_query',
  );
  assert(
    'Lara kim still public_profile',
    classifyPrivacyIntent('Lara kim?').requestType === 'public_profile',
  );

  resetConversationState('t-prop');
  seedParticipantFact('t-prop', {
    displayName: 'Lara',
    field: 'zodiac',
    value: 'Kova',
  });
  const r = tryResolveConversationContext({
    conversationId: 't-prop',
    message: 'Lara senin burcun nedir?',
    sender: FURKAN,
  });
  assert('property reply short', r.handled && /Lara.*burcu\s+Kova/i.test(r.reply), r.reply);
  assert(
    'property no bio dump',
    r.handled && !/kurucu|mimari|cosmicsimya|creative director/i.test(r.reply),
    r.reply,
  );
}

// ── Unit: short tokens not addressing ──
console.log('\n--- Short utterance / non-name ---');
assert('Kova not ambiguous identity', analyzeIdentityClaim('Kova').kind === 'none');
assert('Senin not ambiguous identity', analyzeIdentityClaim('Senin').kind === 'none');
assert('Aslan not ambiguous identity', analyzeIdentityClaim('Aslan').kind === 'none');

// ── Multi-turn fixtures (≥8) ──
console.log('\n--- Multi-turn fixtures ---');

// MT1: short answer slot filling
{
  const cid = 'mt-slot';
  resetConversationState(cid);
  const r1 = tryResolveConversationContext({
    conversationId: cid,
    message: 'Lara senin burcun nedir?',
    sender: FURKAN,
  });
  assert('MT1 ask unknown', r1.handled && /doğrulanmış bilgim yok|yok/i.test(r1.reply), r1.reply);
  const r2 = tryResolveConversationContext({
    conversationId: cid,
    message: 'Kova',
    sender: LARA,
  });
  assert('MT1 slot fill', r2.handled && /Kova/i.test(r2.reply) && !/hitap/i.test(r2.reply), r2.reply);
  assert('MT1 intent slot', /slot_fill|direct/i.test(r2.intent + r2.responseMode));
}

// MT2: correction burcu burcu
{
  const cid = 'mt-repair-burc';
  resetConversationState(cid);
  seedParticipantFact(cid, { displayName: 'Lara', field: 'zodiac', value: 'Kova' });
  // Simulate wrong prior assistant claim
  noteAssistantTurn(cid, {
    reply: 'Lara, Atlas sisteminin kurucusudur ve creative director olarak çalışır...',
    intent: 'wrong_bio',
    responseMode: 'other',
  });
  getConversationState(cid).currentQuestion = 'Lara senin burcun nedir?';
  getConversationState(cid).lastExplicitSubject = { displayName: 'Lara', userId: LARA.userId };
  getConversationState(cid).expectedAnswerType = 'zodiac';

  const r = tryResolveConversationContext({
    conversationId: cid,
    message: 'Burcu burcu 😄',
    sender: LARA,
  });
  assert('MT2 repair handled', r.handled && r.responseMode === 'correction_repair', r.reply);
  assert('MT2 mentions burç/Kova', /burc|Kova/i.test(r.reply), r.reply);
  assert('MT2 no hitap', !/hitap/i.test(r.reply || ''));
}

// MT3: pronoun correction Senin
{
  const cid = 'mt-pronoun';
  resetConversationState(cid);
  seedParticipantFact(cid, { displayName: 'Lara', field: 'zodiac', value: 'Kova' });
  getConversationState(cid).currentQuestion = 'Lara senin burcun nedir?';
  getConversationState(cid).lastExplicitSubject = { displayName: 'Lara' };
  getConversationState(cid).lastAssistantClaim =
    'Kova olarak hitap etmemi mi istiyorsun, yoksa Kova hakkında bilgi mi soruyorsun?';
  getConversationState(cid).expectedAnswerType = 'zodiac';

  const r = tryResolveConversationContext({
    conversationId: cid,
    message: 'Senin',
    sender: LARA,
  });
  assert('MT3 pronoun repair', r.handled && !/hitap/i.test(r.reply || ''), r.reply);
  assert('MT3 understands subject', /Lara|burc/i.test(r.reply), r.reply);
}

// MT4: assistant identity
{
  const cid = 'mt-atlas-zodiac';
  resetConversationState(cid);
  const r = tryResolveConversationContext({
    conversationId: cid,
    message: 'Sen Aslan burcusun Atlas.',
    sender: LARA,
  });
  assert('MT4 handled', r.handled, r.reply);
  assert('MT4 no real zodiac claim', !/Evet,?\s*ben Aslan/i.test(r.reply || '') && /gerçek bir burcum yok/i.test(r.reply), r.reply);
  const atlasBucket = Object.values(getConversationState(cid).participantFactsByTelegramId).find(
    (b) => /atlas/i.test(b.__displayName?.value || ''),
  );
  assert('MT4 no atlas zodiac persist', !atlasBucket?.zodiac || atlasBucket.zodiac.temporary);
}

// MT5: sender fact binding
{
  const cid = 'mt-sender-bind';
  resetConversationState(cid);
  const r = tryResolveConversationContext({
    conversationId: cid,
    message: 'Ben zaten doğuştan aslanım.',
    sender: FURKAN,
    persistFacts: false,
  });
  assert('MT5 self fact', r.handled && /Aslan/i.test(r.reply) && !/hitap/i.test(r.reply), r.reply);
  const state = getConversationState(cid);
  const furkanFact = state.participantFactsByTelegramId[FURKAN.userId]?.zodiac?.value;
  const nameLara = state.participantFactsByTelegramId[`name:lara`]?.zodiac?.value;
  assert('MT5 furkan bound', furkanFact === 'Aslan', String(furkanFact));
  assert('MT5 lara not updated', !nameLara);
}

// MT6: referential set
{
  const cid = 'mt-anaphora';
  resetConversationState(cid);
  tryResolveConversationContext({
    conversationId: cid,
    message: 'Su grubundaki burçlar çokmuş.',
    sender: FURKAN,
    history: [],
  });
  const r = tryResolveConversationContext({
    conversationId: cid,
    message: 'Hepsi 3 tane.',
    sender: LARA,
    history: [
      { role: 'user', content: 'Su grubundaki burçlar çokmuş.' },
    ],
  });
  assert('MT6 anaphora', r.handled && /dört element|ucer|üçer/i.test(r.reply), r.reply);
  assert('MT6 not only water list', !/^Su grubundaki burçlar üçtür/i.test(r.reply || ''));
}

// MT7: casual banter
{
  const cid = 'mt-banter';
  resetConversationState(cid);
  // Seed prior Aslan facts to ensure we don't essay
  noteAssistantTurn(cid, {
    reply: '26 Temmuz Aslan burcuna ait. Liderlik, cesaret, sıcaklık...',
    intent: 'astro',
    factStated: '26 Temmuz = Aslan',
  });
  const r = tryResolveConversationContext({
    conversationId: cid,
    message: 'Tek burç aslandır 😋',
    sender: FURKAN,
  });
  assert('MT7 banter short', r.handled && (r.reply || '').split(/\s+/).length <= 12, r.reply);
  assert('MT7 no encyclopedia', !/liderlik|kendine özgü|enerji taşıdığı/i.test(r.reply || ''), r.reply);
}

// MT8: topic continuity collect
{
  const cid = 'mt-collect';
  resetConversationState(cid);
  tryResolveConversationContext({
    conversationId: cid,
    message: 'Herkes burcunu yazsın, grubu analiz edelim.',
    sender: LARA,
  });
  tryResolveConversationContext({
    conversationId: cid,
    message: 'Kova',
    sender: LARA,
  });
  tryResolveConversationContext({
    conversationId: cid,
    message: 'Benim aslan',
    sender: FURKAN,
  });
  const r = tryResolveConversationContext({
    conversationId: cid,
    message: 'Şu an bildiklerin neler, özet?',
    sender: LARA,
  });
  assert('MT8 status', r.handled && /Lara.*Kova|Kova/i.test(r.reply) && /Furkan.*Aslan|Aslan/i.test(r.reply), r.reply);
  assert('MT8 no invent', !/Yengeç|Akrep|Balık.*uydur/i.test(r.reply || ''));
}

// MT9: Atlas da mı aslan
{
  const cid = 'mt-atlas-ask';
  resetConversationState(cid);
  const r = tryResolveConversationContext({
    conversationId: cid,
    message: 'A Atlas da mı aslan',
    sender: FURKAN,
  });
  assert('MT9 atlas ask', r.handled && /gerçek bir burcum yok|bu sohbette/i.test(r.reply), r.reply);
}

// MT10: repetition guard
{
  const cid = 'mt-rep';
  resetConversationState(cid);
  noteAssistantTurn(cid, {
    reply: '26 Temmuz Aslan burcuna aittir. Liderlik ve cesaret...',
    factStated: '26 temmuz aslan',
  });
  noteAssistantTurn(cid, {
    reply: 'Aslan burcuna ait enerjiler liderlik, cesaret, sıcaklık...',
    factStated: 'aslan liderlik',
  });
  const guarded = applyRepetitionGuard(
    '26 Temmuz Aslan burcuna aittir. Liderlik, cesaret ve sıcaklık öne çıkar.',
    getConversationState(cid),
  );
  assert('MT10 repetition changed', guarded.changed);
  assert('MT10 short', guarded.reply.split(/\s+/).length <= 15, guarded.reply);
}

// MT11: processAtlasMessage presence e2e
{
  const cid = 'mt-e2e-presence';
  resetConversationState(cid);
  const r = await msg(cid, FURKAN, 'Ordamısın');
  assert('MT11 e2e presence', /Buradayım/i.test(r.reply) && !/hitap/i.test(r.reply), r.reply);
  assert(
    'MT11 engine',
    r.engine === 'conversation-context' ||
      r.engine === 'conversation-style' ||
      r.engine === 'conversation-activation',
    r.engine,
  );
}

// MT12: processAtlasMessage property + slot via pipeline
{
  const cid = 'mt-e2e-prop';
  resetConversationState(cid);
  seedParticipantFact(cid, { displayName: 'Lara', field: 'zodiac', value: 'Kova' });
  const r1 = await msg(cid, FURKAN, 'Lara senin burcun nedir?');
  assert('MT12 property e2e', /Lara.*burcu\s+Kova/i.test(r1.reply), r1.reply);
  assert('MT12 no founder dump', !/creative director|kurucusudur/i.test(r1.reply));

  resetConversationState('mt-e2e-slot');
  const rAsk = await msg('mt-e2e-slot', FURKAN, "Lara'nın burcu nedir?");
  assert('MT12b unknown opens slot', /yok|bilgim yok/i.test(rAsk.reply), rAsk.reply);
  const rFill = await msg('mt-e2e-slot', LARA, 'Kova', [
    { role: 'user', content: "Lara'nın burcu nedir?" },
    { role: 'assistant', content: rAsk.reply },
  ]);
  assert('MT12b slot e2e', /Kova/i.test(rFill.reply) && !/hitap/i.test(rFill.reply), rFill.reply);
}

// Memory safety: Atlas zodiac must not write user memory
console.log('\n--- Memory safety ---');
{
  const cid = 'mem-atlas';
  resetConversationState(cid);
  const before = JSON.stringify(getUserMemory(FURKAN.userId)?.facts || {});
  tryResolveConversationContext({
    conversationId: cid,
    message: 'Sen Aslan burcusun Atlas',
    sender: FURKAN,
    persistFacts: true,
  });
  const after = JSON.stringify(getUserMemory(FURKAN.userId)?.facts || {});
  assert('mem atlas no side write to furkan', before === after || !/Aslan/.test(getUserMemory(FURKAN.userId)?.facts?.zodiac || ''));

  const bind = validateAndBindParticipantFact({
    subjectDisplayName: 'Atlas',
    field: 'zodiac',
    value: 'Aslan',
    sourceSpeakerUserId: FURKAN.userId,
    explicit: true,
    roleplay: true,
    temporary: true,
    state: getConversationState(cid),
    persist: true,
  });
  assert('mem atlas bind rejected', bind.ok === false);
}

// Response mode classification
console.log('\n--- Response modes ---');
assert('mode presence', classifyResponseMode('Ordamısın', { presence: true }) === 'presence');
assert(
  'mode property',
  classifyResponseMode('Lara senin burcun nedir?', {
    propertyQuery: detectProfilePropertyQuery('Lara senin burcun nedir?'),
  }) === 'profile_property_query',
);
assert('mode banter', classifyResponseMode('Tek burç aslandır 😋') === 'casual_banter');
assert('canonicalize Kova', canonicalizeZodiac('kova') === 'Kova');
assert('canonicalize Aslan', canonicalizeZodiac('ASLAN') === 'Aslan');

// Deterministic style still works for Atlas ping
assert(
  'style Atlas ping',
  tryDeterministicConversationReply({ message: 'Atlas' })?.reply === 'Buradayım.',
);

// General repair signal (distinct from the zodiac-scoped REPAIR_RE above)
console.log('\n--- General repair signal ---');
{
  const { detectGeneralRepairSignal } = await import('../server/general-repair-signal.js');
  const errorState = { lastEngineInvocation: { engine: 'abjad-verification', status: 'ambiguous' } };
  const okState = { lastEngineInvocation: { engine: 'abjad-verification', status: 'ok' } };

  const resumable = detectGeneralRepairSignal('tövbe yarabbi', errorState);
  assert('tövbe yarabbi + ambiguous last turn → resumable', resumable.hasResumableEngine === true);

  const notResumable = detectGeneralRepairSignal('tövbe yarabbi', okState);
  assert('tövbe yarabbi + ok last turn → not resumable (stays on zodiac-repair path)', notResumable.hasResumableEngine === false);

  const noState = detectGeneralRepairSignal('tövbe yarabbi', null);
  assert('tövbe yarabbi + no prior engine turn → not resumable', noState.hasResumableEngine === false);

  const noMatch = detectGeneralRepairSignal('merhaba nasılsın', errorState);
  assert('unrelated casual message does not match', noMatch.matched === false);

  // QUALITY REVIEW B1 regression: "ay atlas" / "allah allah" are common
  // casual interjections and must not hijack an unrelated message just
  // because they appear in it — only when they make up essentially the
  // whole message are they trusted as a repair signal.
  const falsePositive = detectGeneralRepairSignal('ay atlas, bugün hava nasıl olacak?', errorState);
  assert(
    'B1: "ay atlas" embedded in an unrelated sentence does not match (false-positive fix)',
    falsePositive.matched === false && falsePositive.hasResumableEngine === false,
  );

  const truePositiveAnchored = detectGeneralRepairSignal('allah allah', errorState);
  assert(
    'B1: "allah allah" as the whole message still matches (true positive preserved)',
    truePositiveAnchored.hasResumableEngine === true,
  );

  const truePositiveAnchoredPunct = detectGeneralRepairSignal('Ay atlas!', errorState);
  assert(
    'B1: "ay atlas" with trailing punctuation, anchored, still matches',
    truePositiveAnchoredPunct.hasResumableEngine === true,
  );
}

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===\n`);
if (failed.length) {
  console.error('Failures:');
  for (const f of failed) console.error(' -', f.label, f.detail);
  process.exit(1);
}
