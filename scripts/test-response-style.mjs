/**
 * Response style smoke tests — founder + regular user.
 * Run: node scripts/test-response-style.mjs
 */
import 'dotenv/config';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { clearAtlasModuleCache } from '../server/atlas-prompt-loader.js';
import { resolveFounderSession } from '../server/founder-identity.js';

clearAtlasModuleCache();

const cases = [
  { label: 'Selam Atlas', message: 'Selam Atlas', userId: 'telegram:7142880605', channel: 'telegram' },
  { label: 'Nasılsın?', message: 'Nasılsın?', userId: 'telegram:7142880605', channel: 'telegram' },
  { label: 'Ben kimim?', message: 'Ben kimim?', userId: 'telegram:7142880605', channel: 'telegram' },
  {
    label: 'Backend neden cevap vermiyor?',
    message: 'Backend neden cevap vermiyor?',
    userId: 'telegram:7142880605',
    channel: 'telegram',
  },
  {
    label: 'Bunu detaylı anlat.',
    message: 'Atlas nedir, bunu detaylı anlat.',
    userId: 'telegram:7142880605',
    channel: 'telegram',
  },
  {
    label: 'Non-founder Selam Atlas',
    message: 'Selam Atlas',
    userId: 'telegram:5224437864',
    channel: 'telegram',
  },
  {
    label: 'Web Selam Atlas',
    message: 'Selam Atlas',
    userId: 'web:style-test-session',
    channel: 'web',
  },
];

function sentenceCount(text) {
  return (text.match(/[.!?…]+(\s|$)/g) || []).length || (text.trim() ? 1 : 0);
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const results = [];

for (const c of cases) {
  const founder = resolveFounderSession(c.userId);
  const out = await processAtlasMessage({
    channel: c.channel,
    userId: c.userId,
    conversationId: `style-${c.userId}`,
    message: c.message,
    history: [],
    metadata: c.channel === 'telegram' ? { telegramFromId: c.userId.replace('telegram:', '') } : {},
  });

  const reply = out.reply ?? '';
  const words = wordCount(reply);
  const sentences = sentenceCount(reply);
  const founderResolved = Boolean(out.data?.pipelineDebug?.founderResolved ?? founder);
  const jargonHits = (reply.match(/\b(mimari|vizyon|omurga|sistem mimar)\b/gi) || []).length;

  results.push({
    label: c.label,
    status: out.status,
    founderResolved,
    words,
    sentences,
    jargonHits,
    reply,
  });

  console.log(`\n=== ${c.label} ===`);
  console.log(`founderResolved=${founderResolved} words=${words} sentences=${sentences} jargon=${jargonHits}`);
  console.log(reply);
}

const shortOk = results
  .filter((r) => ['Selam Atlas', 'Nasılsın?', 'Non-founder Selam Atlas', 'Web Selam Atlas'].includes(r.label))
  .every((r) => r.words <= 60 && r.sentences <= 5);

const identityOk = results.find((r) => r.label === 'Ben kimim?');
const founderIdentityOk =
  identityOk &&
  identityOk.founderResolved === true &&
  /kurucu|lara|cosmicsimya/i.test(identityOk.reply);

const detail = results.find((r) => r.label === 'Bunu detaylı anlat.');
const detailOk = detail && detail.words >= 40;

console.log('\n=== CHECKS ===');
console.log('short_replies_ok', shortOk);
console.log('founder_identity_ok', Boolean(founderIdentityOk));
console.log('detail_longer_ok', Boolean(detailOk));
console.log(
  'non_founder_not_founder',
  results.find((r) => r.label === 'Non-founder Selam Atlas')?.founderResolved === false,
);
