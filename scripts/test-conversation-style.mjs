/**
 * Conversation style acceptance tests (deterministic + API smoke).
 * Run: node scripts/test-conversation-style.mjs
 */
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
import 'dotenv/config';
import {
  detectConversationIntent,
  tryDeterministicConversationReply,
  containsForbiddenCasualPhrase,
  FORBIDDEN_CASUAL_PHRASES,
  isConceptualHijriCalendarQuery,
  isCurrentHijriDateQuery,
  formatCurrentHijriDateReply,
  resolveReplyMaxTokens,
} from '../server/atlas-conversation-style.js';
import {
  processAtlasMessage,
  buildAtlasPromptBundle,
  scoreDetailReplyLayers,
  buildDetailIntentRuntimeDirective,
} from '../server/atlas-message-service.js';
import { clearAtlasModuleCache } from '../server/atlas-prompt-loader.js';
import { resolveFounderSession } from '../server/founder-identity.js';

clearAtlasModuleCache();

const results = [];

function wordCount(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function record(row) {
  results.push(row);
  const flag = row.pass ? '✓' : '✗';
  console.log(
    `${flag} ${row.label} | words=${row.words} | founder=${row.founderResolved} | ${row.reply}`,
  );
  if (!row.pass) console.log('   fail:', row.reason);
}

// ── Unit: intent detection ──
const intentCases = [
  ['Merhaba', 'greeting'],
  ['Nasılsın?', 'how_are_you'],
  ['Ben kimim?', 'who_am_i'],
  ['Sen kimsin?', 'who_are_you'],
  ['Teşekkürler.', 'thanks'],
  ['Atlas', 'ping'],
  ['Bugün biraz yorgunum.', 'fatigue'],
  ['Backend neden cevap vermiyor?', 'backend_diag'],
  ['Bunu detaylı anlat.', 'detail'],
  ['Hicri?', 'get_current_hijri_date'],
  ['Hicrî?', 'get_current_hijri_date'],
  ['Hicri tarih?', 'get_current_hijri_date'],
  ['Bugün hicri?', 'get_current_hijri_date'],
  ['Hicri bugün kaç?', 'get_current_hijri_date'],
  ['Bugün hicri tarih ne?', 'get_current_hijri_date'],
  ['Bugün hicri tarih nedir?', 'get_current_hijri_date'],
  ['Hicri tarih nedir?', 'get_current_hijri_date'],
  ['Hicrî tarih nedir?', 'get_current_hijri_date'],
  ['Şu an hicri hangi gündeyiz?', 'get_current_hijri_date'],
  ['Hicri ayın kaçı?', 'get_current_hijri_date'],
  ['Hicri ay ne?', 'get_current_hijri_date'],
  ['Bugünün hicri tarihi', 'get_current_hijri_date'],
  ['Bugünün hicri tarihi ne?', 'get_current_hijri_date'],
  ['Bugünün hicri tarihi nedir?', 'get_current_hijri_date'],
  ['Bugünün hicri tarihi kaç?', 'get_current_hijri_date'],
  ['Bugünün hicri tarihi?', 'get_current_hijri_date'],
  ['Bugün hicri tarih kaç?', 'get_current_hijri_date'],
  ['bugun hicri?', 'get_current_hijri_date'],
  ['Hicri kaç?', 'get_current_hijri_date'],
  ['Hicri tarih kaç?', 'get_current_hijri_date'],
  ['Şu an hicri kaç?', 'get_current_hijri_date'],
  ['Bugün hangi hicri aydayız?', 'get_current_hijri_date'],
  ['Bugünün hijri tarihi ne?', 'get_current_hijri_date'],
  ['Hicri takvim nedir?', 'other'],
  ['Hicri takvim nasıl hesaplanır?', 'other'],
  ['Hicri ve Miladi takvim arasındaki fark nedir?', 'other'],
  ['Hicri ay nedir?', 'other'],
  ['Hicri takvimin başlangıcı nedir?', 'other'],
];


for (const [msg, expected] of intentCases) {
  const got = detectConversationIntent(msg);
  record({
    label: `intent:${msg}`,
    words: 0,
    founderResolved: null,
    reply: got,
    pass: got === expected,
    reason: got === expected ? '' : `expected ${expected}`,
  });
}

record({
  label: 'conceptual:Hicri takvim nedir',
  words: 0,
  founderResolved: null,
  reply: String(isConceptualHijriCalendarQuery('Hicri takvim nedir?')),
  pass:
    isConceptualHijriCalendarQuery('Hicri takvim nedir?') === true &&
    isCurrentHijriDateQuery('Hicri takvim nedir?') === false,
  reason: '',
});

record({
  label: 'conceptual:not Hicri tarih nedir',
  words: 0,
  founderResolved: null,
  reply: String(isConceptualHijriCalendarQuery('Hicri tarih nedir?')),
  pass:
    isConceptualHijriCalendarQuery('Hicri tarih nedir?') === false &&
    isCurrentHijriDateQuery('Hicri tarih nedir?') === true,
  reason: '',
});

{
  const rejectCurrent = [
    'Hicri takvim nedir?',
    'Hicri takvim nasıl hesaplanır?',
    'Hicri ve Miladi takvim arasındaki fark nedir?',
    'Hicri ay nedir?',
    'Hicri takvimin başlangıcı nedir?',
    'ne?',
    'nedir?',
    'kaç?',
  ];
  for (const msg of rejectCurrent) {
    record({
      label: `reject-current:${msg}`,
      words: 0,
      founderResolved: null,
      reply: detectConversationIntent(msg),
      pass: isCurrentHijriDateQuery(msg) === false,
      reason: isCurrentHijriDateQuery(msg) ? 'should not be current hijri date' : '',
    });
  }
}

{
  const fixed = formatCurrentHijriDateReply(
    new Date('2026-08-01T12:00:00+03:00'),
    'Europe/Istanbul',
  );
  record({
    label: 'format:2026-08-01 → 18 Safer 1448',
    words: wordCount(fixed),
    founderResolved: null,
    reply: fixed,
    pass: /18 Safer 1448/.test(fixed) && !/Muharrem|24 Muharrem/i.test(fixed),
    reason: /18 Safer 1448/.test(fixed) ? '' : `got: ${fixed}`,
  });
}

// ── Unit: deterministic founder / non-founder ──
const founder = resolveFounderSession('telegram:7142880605');
const det = [
  {
    label: 'det:Merhaba founder',
    message: 'Merhaba',
    userId: 'telegram:7142880605',
    maxWords: 10,
    mustNotSelf: true,
  },
  {
    label: 'det:Nasılsın',
    message: 'Nasılsın?',
    userId: 'telegram:7142880605',
    maxWords: 15,
  },
  {
    label: 'det:Ben kimim founder',
    message: 'Ben kimim?',
    userId: 'telegram:7142880605',
    maxWords: 20,
    mustMatch: /lara/i,
    mustNot: /ben atlas/i,
  },
  {
    label: 'det:Ben kimim non-founder',
    message: 'Ben kimim?',
    userId: 'telegram:5224437864',
    maxWords: 20,
    mustMatch: /yeterli bilgim yok|adın/i,
    mustNot: /lara|kurucu/i,
  },
  {
    label: 'det:Sen kimsin',
    message: 'Sen kimsin?',
    userId: 'telegram:7142880605',
    maxWords: 25,
    mustMatch: /ben atlas/i,
  },
  {
    label: 'det:Backend',
    message: 'Backend neden cevap vermiyor?',
    userId: 'telegram:7142880605',
    maxWords: 25,
    mustMatch: /atlas:status/i,
  },
  {
    label: 'det:Teşekkürler',
    message: 'Teşekkürler.',
    userId: 'telegram:7142880605',
    maxWords: 5,
  },
  {
    label: 'det:Atlas',
    message: 'Atlas',
    userId: 'telegram:7142880605',
    maxWords: 3,
  },
  {
    label: 'det:Yorgun',
    message: 'Bugün biraz yorgunum.',
    userId: 'telegram:7142880605',
    maxWords: 15,
  },
  {
    label: 'det:Hicri?',
    message: 'Hicri?',
    userId: 'telegram:7142880605',
    maxWords: 25,
    mustMatch: /hicri takvime göre/i,
    mustNot: /hitap|muharrem/i,
  },
  {
    label: 'det:Hicri tarih nedir',
    message: 'Hicri tarih nedir',
    userId: 'web:style-web-1',
    maxWords: 25,
    mustMatch: /hicri takvime göre/i,
    mustNot: /hitap|takvim.*nedir|muharrem/i,
  },
  {
    label: 'det:Bugünün hicri tarihi ne?',
    message: 'Bugünün hicri tarihi ne?',
    userId: 'web:style-web-1',
    maxWords: 25,
    mustMatch: /hicri takvime göre/i,
    mustNot: /hitap|muharrem/i,
  },
];


for (const c of det) {
  const out = tryDeterministicConversationReply({
    message: c.message,
    userId: c.userId,
    founderSession: resolveFounderSession(c.userId),
  });
  const reply = out?.reply ?? '';
  const words = wordCount(reply);
  const forbidden = containsForbiddenCasualPhrase(reply);
  const reasons = [];
  if (!out) reasons.push('no deterministic reply');
  if (words > c.maxWords) reasons.push(`words ${words}>${c.maxWords}`);
  if (forbidden.length) reasons.push(`forbidden: ${forbidden.join(',')}`);
  if (c.mustMatch && !c.mustMatch.test(reply)) reasons.push('mustMatch failed');
  if (c.mustNot && c.mustNot.test(reply)) reasons.push('mustNot failed');
  if (c.mustNotSelf && /ben atlas|dijital yol/i.test(reply)) reasons.push('self-intro');
  record({
    label: c.label,
    words,
    founderResolved: Boolean(resolveFounderSession(c.userId)),
    reply,
    pass: reasons.length === 0,
    reason: reasons.join('; '),
  });
}

// ── Prompt assembly: casual founder — no identity injection (context gate) ──
const casualBundle = buildAtlasPromptBundle({
  channel: 'telegram',
  userId: 'telegram:7142880605',
  conversationId: '1',
  message: 'Merhaba',
  history: [],
});
const heavyKnowledgeInjected = Boolean(casualBundle.founderProfileKnowledgeContext);
const compactIdentityInjected = Boolean(casualBundle.founderIdentityContext);
record({
  label: 'prompt:casual no founder identity (gate closed)',
  words: 0,
  founderResolved: true,
  reply: heavyKnowledgeInjected
    ? 'HEAVY'
    : compactIdentityInjected
      ? 'compact'
      : 'gated',
  pass:
    casualBundle.founderSession?.resolved === true &&
    !compactIdentityInjected &&
    !heavyKnowledgeInjected &&
    casualBundle.systemPrompt.includes('ATLAS CONVERSATION STYLE') &&
    !casualBundle.systemPrompt.includes('Kurucu Oturumu Aktif'),
  reason: heavyKnowledgeInjected
    ? 'heavy founder knowledge still injected on greeting'
    : compactIdentityInjected
      ? 'compact founder identity still injected on greeting'
      : casualBundle.systemPrompt.includes('Kurucu Oturumu Aktif')
        ? 'Kurucu Oturumu still present on greeting'
        : '',
});

const whoBundle = buildAtlasPromptBundle({
  channel: 'telegram',
  userId: 'telegram:7142880605',
  conversationId: '1',
  message: 'Ben kimim?',
  history: [],
});
record({
  label: 'prompt:who_am_i injects founder',
  words: 0,
  founderResolved: true,
  reply: whoBundle.founderIdentityContext ? 'injected' : 'missing',
  pass:
    Boolean(whoBundle.founderIdentityContext) &&
    whoBundle.systemPrompt.includes('Kurucu Oturumu Aktif'),
  reason: '',
});

const groupBundle = buildAtlasPromptBundle({
  channel: 'telegram',
  userId: 'telegram:7142880605',
  conversationId: '1',
  message: 'Ben kimim?',
  history: [],
  metadata: { isGroup: true, chatType: 'supergroup' },
});
record({
  label: 'prompt:group never injects founder identity',
  words: 0,
  founderResolved: true,
  reply: groupBundle.founderIdentityContext ? 'leaked' : 'gated',
  pass:
    groupBundle.founderSession?.resolved === true &&
    !groupBundle.founderIdentityContext &&
    !groupBundle.founderProfileKnowledgeContext &&
    !groupBundle.systemPrompt.includes('Kurucu Oturumu Aktif'),
  reason: groupBundle.founderIdentityContext
    ? 'founder identity leaked in group'
    : '',
});

// ── Pipeline smoke (deterministic path via processAtlasMessage) ──
const pipelineCases = [
  { label: 'pipe:Merhaba TG', message: 'Merhaba', userId: 'telegram:7142880605', channel: 'telegram', max: 10 },
  { label: 'pipe:Merhaba Web', message: 'Merhaba', userId: 'web:style-web-1', channel: 'web', max: 10 },
  { label: 'pipe:Nasılsın', message: 'Nasılsın?', userId: 'telegram:7142880605', channel: 'telegram', max: 15 },
  { label: 'pipe:Ben kimim F', message: 'Ben kimim?', userId: 'telegram:7142880605', channel: 'telegram', max: 20 },
  { label: 'pipe:Ben kimim NF', message: 'Ben kimim?', userId: 'telegram:5224437864', channel: 'telegram', max: 20 },
  { label: 'pipe:Sen kimsin', message: 'Sen kimsin?', userId: 'telegram:7142880605', channel: 'telegram', max: 25 },
  { label: 'pipe:Teşekkür', message: 'Teşekkürler.', userId: 'telegram:7142880605', channel: 'telegram', max: 5 },
  { label: 'pipe:Atlas', message: 'Atlas', userId: 'telegram:7142880605', channel: 'telegram', max: 3 },
  { label: 'pipe:Yorgun', message: 'Bugün biraz yorgunum.', userId: 'telegram:7142880605', channel: 'telegram', max: 15 },
  { label: 'pipe:Backend', message: 'Backend neden cevap vermiyor?', userId: 'telegram:7142880605', channel: 'telegram', max: 25 },
  {
    label: 'pipe:Hicri?',
    message: 'Hicri?',
    userId: 'telegram:7142880605',
    channel: 'telegram',
    max: 25,
    mustMatch: /hicri takvime göre/i,
    mustNot: /hitap/i,
  },
  {
    label: 'pipe:Hicri tarih nedir',
    message: 'Hicri tarih nedir',
    userId: 'web:style-web-1',
    channel: 'web',
    max: 25,
    mustMatch: /hicri takvime göre/i,
    mustNot: /hitap|24 Muharrem/i,
  },
];

for (const c of pipelineCases) {
  const out = await processAtlasMessage({
    channel: c.channel,
    userId: c.userId,
    conversationId: `pipe-${c.label}`,
    message: c.message,
    history: [],
    metadata: c.channel === 'telegram' ? { telegramFromId: c.userId.replace('telegram:', '') } : {},
  });
  const reply = out.reply ?? '';
  const words = wordCount(reply);
  const forbidden = containsForbiddenCasualPhrase(reply);
  const founderResolved = Boolean(out.data?.pipelineDebug?.founderResolved);
  const reasons = [];
  if (words > c.max) reasons.push(`words ${words}>${c.max}`);
  if (forbidden.length) reasons.push(`forbidden ${forbidden.join(',')}`);
  if (c.mustMatch && !c.mustMatch.test(reply)) reasons.push('mustMatch failed');
  if (c.mustNot && c.mustNot.test(reply)) reasons.push('mustNot failed');
  if (c.label.includes('Ben kimim F') && /ben atlas/i.test(reply)) reasons.push('self as user');
  if (c.label.includes('Ben kimim NF') && /lara|kurucu/i.test(reply)) reasons.push('founder leak');
  if (c.label.includes('Sen kimsin') && !/ben atlas/i.test(reply)) reasons.push('not atlas');
  if (c.label.includes('Sen kimsin') && /yapay zek[aâ] asistan/i.test(reply)) {
    reasons.push('assistant cliché');
  }
  record({
    label: c.label,
    words,
    founderResolved,
    reply,
    pass: reasons.length === 0 && out.status === 'complete',
    reason: reasons.join('; '),
  });
}

// ── Required fixture: Bugünün hicri tarihi ne? — deterministic, no LLM ──
{
  const fixtureMsg = 'Bugünün hicri tarihi ne?';
  let llmCalled = false;
  const expectedFixed = formatCurrentHijriDateReply(
    new Date('2026-08-01T12:00:00+03:00'),
    'Europe/Istanbul',
  );
  const expectedNow = formatCurrentHijriDateReply(new Date(), 'Europe/Istanbul');

  const tg = await processAtlasMessage(
    {
      channel: 'telegram',
      userId: 'telegram:7142880605',
      conversationId: 'pipe-hijri-bugunun-tg',
      message: fixtureMsg,
      history: [],
      metadata: { telegramFromId: '7142880605' },
    },
    {
      callOpenAI: async () => {
        llmCalled = true;
        throw new Error('LLM must not be called for get_current_hijri_date');
      },
    },
  );
  const web = await processAtlasMessage(
    {
      channel: 'web',
      userId: 'web:style-web-1',
      conversationId: 'pipe-hijri-bugunun-web',
      message: fixtureMsg,
      history: [],
    },
    {
      callOpenAI: async () => {
        llmCalled = true;
        throw new Error('LLM must not be called for get_current_hijri_date');
      },
    },
  );

  const reasons = [];
  if (detectConversationIntent(fixtureMsg) !== 'get_current_hijri_date') {
    reasons.push('intent not get_current_hijri_date');
  }
  if (tg.data?.conversationIntent !== 'get_current_hijri_date') {
    reasons.push(`tg conversationIntent=${tg.data?.conversationIntent}`);
  }
  if (tg.engine !== 'conversation-style') reasons.push(`tg engine=${tg.engine}`);
  if (web.engine !== 'conversation-style') reasons.push(`web engine=${web.engine}`);
  if (llmCalled) reasons.push('LLM was invoked');
  if (tg.reply !== web.reply) reasons.push('telegram/web reply mismatch');
  if (tg.reply !== expectedNow) reasons.push('reply != formatCurrentHijriDateReply(now)');
  if (!/hicri takvime göre/i.test(tg.reply ?? '')) reasons.push('missing hicri phrase');
  if (!/18 Safer 1448/.test(expectedFixed) || /Muharrem/i.test(expectedFixed)) {
    reasons.push(`fixed Aug1 mapping broken: ${expectedFixed}`);
  }
  // When "now" is 1 Aug 2026 Istanbul, live reply must carry 18 Safer 1448 via calendar builder.
  const nowIstanbulDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (nowIstanbulDay === '2026-08-01' && !/18 Safer 1448/.test(tg.reply ?? '')) {
    reasons.push('live 2026-08-01 reply missing 18 Safer 1448');
  }

  record({
    label: 'pipe:Bugünün hicri tarihi ne? TG+Web LLM-bypass',
    words: wordCount(tg.reply),
    founderResolved: Boolean(tg.data?.pipelineDebug?.founderResolved),
    reply: tg.reply ?? '',
    pass: reasons.length === 0 && tg.status === 'complete' && web.status === 'complete',
    reason: reasons.join('; '),
  });
}

// consistency: same greeting 3x
const greets = [];
for (let i = 0; i < 3; i += 1) {
  const out = await processAtlasMessage({
    channel: 'telegram',
    userId: 'telegram:7142880605',
    conversationId: `cons-${i}`,
    message: 'Merhaba',
    history: [],
    metadata: { telegramFromId: '7142880605' },
  });
  greets.push(out.reply);
}
record({
  label: 'consistency:Merhaba x3',
  words: wordCount(greets[0]),
  founderResolved: true,
  reply: greets.join(' | '),
  pass: greets.every((g) => g === greets[0]),
  reason: greets.every((g) => g === greets[0]) ? '' : 'inconsistent',
});

// detail intent: deterministic contract (no live LLM flake)
const detailMessage = 'Atlas nedir, bunu detaylı anlat.';
const detailIntent = detectConversationIntent(detailMessage);
const detailBudget = resolveReplyMaxTokens(detailMessage, { intent: detailIntent });
record({
  label: 'detail:intent+budget',
  words: 0,
  founderResolved: false,
  reply: `intent=${detailIntent} maxTokens=${detailBudget}`,
  pass: detailIntent === 'detail' && detailBudget >= 900,
  reason:
    detailIntent === 'detail' && detailBudget >= 900
      ? ''
      : 'detail intent must unlock long first-turn budget',
});

const detailDirective = buildDetailIntentRuntimeDirective(detailMessage);
record({
  label: 'detail:runtime directive layers',
  words: wordCount(detailDirective),
  founderResolved: false,
  reply: detailDirective.slice(0, 120),
  pass:
    /DETAIL MODE/i.test(detailDirective) &&
    /kimliği|yetenek|sınır/i.test(detailDirective) &&
    /kısa özet.*DEĞİL|yeterli DEĞİL/i.test(detailDirective),
  reason: /DETAIL MODE/i.test(detailDirective) ? '' : 'missing detail directive',
});

const mockDetailReply = [
  'Atlas, Cosmic Simya’nın yapay zekâ asistanı ve analiz rehberidir.',
  'Numeroloji, astroloji, tarot ve sembolik sentez alanlarında katmanlı yorum üretir; bellek ve kimlik bağlamını korur.',
  'Çalışma biçimi: önce deterministik motorlarla hesap/çerçeve kurar, sonra bağlama göre sentezler; prosedür anlatmak yerine örüntüyü açar.',
  'Sınırı nettir: kesin kehanet, tıbbi/hukuki/finansal hüküm ve uydurma kişisel biyografi üretmez; sembolik olasılık dilinde kalır.',
  'Pratik değeri: kullanıcının sorusunu netleştirip karar ve farkındalık için kullanılabilir bir çerçeve vermektir.',
].join(' ');

let capturedMaxTokens = null;
let capturedSystemHasDetail = false;
const detailOut = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:style-web-1',
    conversationId: 'detail-1',
    message: detailMessage,
    history: [],
  },
  {
    callOpenAI: async (opts) => {
      capturedMaxTokens = opts.maxTokens ?? null;
      capturedSystemHasDetail = /DETAIL MODE/i.test(String(opts.systemPrompt || ''));
      return {
        content: mockDetailReply,
        model: 'mock-detail',
        provider: 'mock',
        tokensUsed: 120,
        costUsd: 0,
        latencyMs: 1,
      };
    },
  },
);

const detailLayers = scoreDetailReplyLayers(detailOut.reply || '', { aboutAtlas: true });
const detailPass =
  detailOut.engine !== 'conversation-style' &&
  Number(capturedMaxTokens) >= 900 &&
  capturedSystemHasDetail &&
  detailLayers.ok &&
  detailLayers.failed.length === 0;

record({
  label: 'api:detail longer',
  words: wordCount(detailOut.reply),
  founderResolved: false,
  reply: (detailOut.reply || '').slice(0, 160),
  pass: detailPass,
  reason: detailPass
    ? ''
    : `engine=${detailOut.engine} maxTokens=${capturedMaxTokens} directive=${capturedSystemHasDetail} layers=${detailLayers.passed}/${detailLayers.total} failed=${detailLayers.failed.join(',')}`,
});

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
console.log('Forbidden phrase list size:', FORBIDDEN_CASUAL_PHRASES.length);
console.log('Founder session for Lara:', Boolean(founder));
if (failed.length) process.exit(1);
