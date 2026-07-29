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
} from '../server/atlas-conversation-style.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { clearAtlasModuleCache } from '../server/atlas-prompt-loader.js';
import { resolveFounderSession } from '../server/founder-identity.js';
import { buildAtlasPromptBundle } from '../server/atlas-message-service.js';

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

// ── Prompt assembly: casual founder must NOT inject heavy blocks ──
const casualBundle = buildAtlasPromptBundle({
  channel: 'telegram',
  userId: 'telegram:7142880605',
  conversationId: '1',
  message: 'Merhaba',
  history: [],
});
const heavyInjected = Boolean(casualBundle.founderIdentityContext);
record({
  label: 'prompt:casual no heavy founder block',
  words: 0,
  founderResolved: true,
  reply: heavyInjected ? 'INJECTED' : 'ok',
  pass: !heavyInjected && casualBundle.systemPrompt.includes('ATLAS CONVERSATION STYLE'),
  reason: heavyInjected ? 'founder identity still injected' : '',
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
  pass: Boolean(whoBundle.founderIdentityContext),
  reason: '',
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
  if (c.label.includes('Ben kimim F') && /ben atlas/i.test(reply)) reasons.push('self as user');
  if (c.label.includes('Ben kimim NF') && /lara|kurucu/i.test(reply)) reasons.push('founder leak');
  if (c.label.includes('Sen kimsin') && !/ben atlas/i.test(reply)) reasons.push('not atlas');
  record({
    label: c.label,
    words,
    founderResolved,
    reply,
    pass: reasons.length === 0 && out.status === 'complete',
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

// detail still uses LLM (optional if no key)
let detailPass = true;
let detailReply = '(skipped — no key)';
if (process.env.OPENAI_API_KEY) {
  const out = await processAtlasMessage({
    channel: 'web',
    userId: 'web:style-web-1',
    conversationId: 'detail-1',
    message: 'Atlas nedir, bunu detaylı anlat.',
    history: [],
  });
  detailReply = out.reply ?? '';
  detailPass = wordCount(detailReply) >= 30 && out.engine !== 'conversation-style';
}
record({
  label: 'api:detail longer',
  words: wordCount(detailReply),
  founderResolved: false,
  reply: detailReply.slice(0, 160),
  pass: detailPass,
  reason: detailPass ? '' : 'expected longer LLM detail',
});

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
console.log('Forbidden phrase list size:', FORBIDDEN_CASUAL_PHRASES.length);
console.log('Founder session for Lara:', Boolean(founder));
if (failed.length) process.exit(1);
