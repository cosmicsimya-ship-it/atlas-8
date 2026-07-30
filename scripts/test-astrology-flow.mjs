/**
 * Astrology / Hijri / ephemeris / clarification flow tests.
 * Run: node scripts/test-astrology-flow.mjs
 */
import 'dotenv/config';
import {
  detectAstrologyFlowIntent,
  tryAstrologyFlowReply,
  buildAstrologyAnalysisContext,
  CLARIFY_ANALYSIS_TYPE_REPLY,
  ASK_BIRTH_DATA_REPLY,
  FATE_REFUSAL_REPLY,
  detectLengthPreference,
} from '../server/atlas-astrology-flow.js';
import { gregorianToHijri, buildSymbolicCalendarContext, hijriMonthSection } from '../server/atlas-symbolic-calendar.js';
import { buildEphemerisSnapshot, longitudeToSignDegree } from '../server/atlas-ephemeris.js';
import { numerologyDayNumber } from '../server/atlas-numerology.js';
import { detectAnalysisMode } from '../server/symbolic-synthesis.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';

const results = [];

function record(label, pass, detail = '') {
  results.push({ label, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function words(s) {
  return String(s ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

// ── Unit: mode no longer over-triggers on bare bugün ──
record(
  'bare bugün is conversational mode',
  detectAnalysisMode('Bugün biraz yorgunum.') === 'conversational',
  detectAnalysisMode('Bugün biraz yorgunum.'),
);

record(
  'astro + bugün is daily-guide mode',
  detectAnalysisMode('Bugünün astrolojik analizini yap') === 'daily-guide',
);

// ── Unit: intents ──
const intentCases = [
  ['Bugünün astrolojik analizini yap.', 'clarify_type'],
  ['Bugünün astrolojik analizini yap', 'clarify_type'],
  ['Genel gökyüzünü anlat.', 'general_daily'],
  ['Benim haritama etkisi nedir?', 'personal_transit'],
  ['İlişkimize etkisi?', 'relationship_clarify'],
  ['Bugünün astrolojik, numerolojik ve Hicri analizini yap.', 'multi_layer_daily'],
  ['Bugün kesin kötü bir şey olacak mı?', 'fate_refusal'],
];

for (const [msg, expected] of intentCases) {
  const got = detectAstrologyFlowIntent(msg);
  record(`intent:${msg.slice(0, 40)}`, got === expected, `got=${got}`);
}

record(
  'follow-up genel after clarify',
  detectAstrologyFlowIntent('Genel olsun; Hicri ve numerolojik etkileri de ekle.', [
    { role: 'assistant', content: CLARIFY_ANALYSIS_TYPE_REPLY },
  ]) === 'multi_layer_daily',
);

record('length short', detectLengthPreference('kısa özet ver') === 'short');
record('length detailed', detectLengthPreference('detaylı analiz') === 'detailed');

// ── Deterministic replies ──
const d1 = tryAstrologyFlowReply({ message: 'Bugünün astrolojik analizini yap.' });
record(
  'clarify does not produce long analysis',
  Boolean(d1) && d1.intent === 'clarify_type' && words(d1.reply) <= 40 && d1.reply.includes('Genel'),
  d1?.reply,
);

const d2 = tryAstrologyFlowReply({ message: 'Benim haritama etkisi nedir?', userId: 'web:no-birth' });
record('personal asks birth data', d2?.reply === ASK_BIRTH_DATA_REPLY, d2?.reply);

const d3 = tryAstrologyFlowReply({ message: 'İlişkimize etkisi?' });
record('relationship clarifies', d3?.intent === 'relationship_clarify', d3?.reply?.slice(0, 80));

const d4 = tryAstrologyFlowReply({ message: 'Bugün kesin kötü bir şey olacak mı?' });
record('fate refusal', d4?.reply === FATE_REFUSAL_REPLY);

record(
  'general daily not deterministic (goes to data+LLM)',
  tryAstrologyFlowReply({ message: 'Genel gökyüzünü anlat.' }) === null,
);

// ── Calendar / Hijri ──
const hijri = gregorianToHijri(2026, 7, 29);
record(
  'hijri converts UAQ 15 Safer 1448',
  hijri.hy === 1448 && hijri.hm === 2 && hijri.hd === 15,
  JSON.stringify(hijri),
);
record('hijri section 1-10', hijriMonthSection(5) === 'baslangic');
record('hijri section 11-20', hijriMonthSection(15) === 'orta');
record('hijri section 21+', hijriMonthSection(25) === 'son');

const cal = buildSymbolicCalendarContext(new Date('2026-07-29T12:00:00+03:00'));
record('calendar ok', cal.ok === true, cal.hijri?.display);
record('calendar method declared', cal.metadata?.method === 'islamic-umalqura');
record('calendar month not Receb', cal.hijri?.monthName !== 'Receb');
record('calendar display Safer', cal.hijri?.display === '15 Safer 1448', cal.hijri?.display);

const num = numerologyDayNumber(2026, 7, 29);
record('numerology has day number', Number.isFinite(num.dayNumber), String(num.dayNumber));

// ── Ephemeris ──
const sky = buildEphemerisSnapshot({ when: new Date('2026-07-29T12:00:00+03:00') });
record('ephemeris ok', sky.ok === true, sky.sun?.display);
record('ephemeris has moon phase', Boolean(sky.moon?.phase), sky.moon?.phase);
record('ephemeris source', sky.metadata?.source === 'astronomy-engine');
record('sign mapping', longitudeToSignDegree(15).sign === 'Koç');

const ctx = buildAstrologyAnalysisContext({
  message: 'Bugünün astrolojik, numerolojik ve Hicri analizini yap.',
});
record('multi context has calendar block', /Hesaplanan Hicri|VERIFIED CALENDAR/i.test(ctx.promptBlock));
record('multi context has ephemeris block', /VERIFIED EPHEMERIS/i.test(ctx.promptBlock));
record('multi context has numerology', /VERIFIED NUMEROLOGY/i.test(ctx.promptBlock));

// Hijri failure path
import { formatCalendarDataBlock } from '../server/atlas-symbolic-calendar.js';
record(
  'hijri missing does not invent',
  /uydurma|hesaplanamadı/i.test(formatCalendarDataBlock({ ok: false, error: 'INVALID_DATE' })),
);

// ── Pipeline ──
const p1 = await processAtlasMessage({
  channel: 'telegram',
  userId: 'telegram:5224437864',
  conversationId: 'astro-1',
  message: 'Bugünün astrolojik analizini yap.',
  history: [],
  metadata: { telegramFromId: '5224437864' },
});
record(
  'pipeline clarify TG',
  p1.engine === 'astrology-flow' && p1.data?.conversationIntent === 'clarify_type' && words(p1.reply) <= 40,
  `${p1.engine} | ${p1.reply}`,
);

const p1w = await processAtlasMessage({
  channel: 'web',
  userId: 'web:astro-web',
  conversationId: 'astro-w1',
  message: 'Bugünün astrolojik analizini yap.',
  history: [],
});
record(
  'pipeline clarify Web parity',
  p1w.reply === p1.reply && p1w.engine === 'astrology-flow',
);

const p2 = await processAtlasMessage({
  channel: 'telegram',
  userId: 'telegram:5224437864',
  conversationId: 'astro-2',
  message: 'Benim haritama etkisi nedir?',
  history: [],
  metadata: { telegramFromId: '5224437864' },
});
record('pipeline asks birth', p2.reply === ASK_BIRTH_DATA_REPLY, p2.reply);

const p3 = await processAtlasMessage({
  channel: 'web',
  userId: 'web:astro-web',
  conversationId: 'astro-3',
  message: 'İlişkimize etkisi?',
  history: [],
});
record('pipeline relationship clarify', p3.engine === 'astrology-flow' && /uyum|etki/i.test(p3.reply));

const p4 = await processAtlasMessage({
  channel: 'web',
  userId: 'web:astro-web',
  conversationId: 'astro-4',
  message: 'Bugün kesin kötü bir şey olacak mı?',
  history: [],
});
record('pipeline fate refusal', p4.reply === FATE_REFUSAL_REPLY);

// Live LLM general + multi (optional)
if (process.env.OPENAI_API_KEY) {
  const gen = await processAtlasMessage({
    channel: 'web',
    userId: 'web:astro-web',
    conversationId: 'astro-gen',
    message: 'Genel gökyüzünü anlat. Kısa özet.',
    history: [],
  });
  const wc = words(gen.reply);
  const hasManifesto = /dijital yol|mimari vizyon|sistemin kalbi/i.test(gen.reply);
  record(
    'llm general short-ish',
    gen.status === 'complete' && gen.engine === 'astrology-analysis' && !hasManifesto && wc <= 220,
    `words=${wc} engine=${gen.engine} meta=${JSON.stringify(gen.data?.astrologyMetadata)}`,
  );

  const multi = await processAtlasMessage({
    channel: 'telegram',
    userId: 'telegram:5224437864',
    conversationId: 'astro-multi',
    message: 'Bugünün astrolojik, numerolojik ve Hicri analizini yap.',
    history: [],
    metadata: { telegramFromId: '5224437864' },
  });
  const body = multi.reply ?? '';
  record(
    'llm multi has dates/layers cues',
    multi.engine === 'astrology-analysis' &&
      (/20\d{2}|Hicri|Muharrem|Safer|Rebi|Cemazi|Recep|Şaban|Ramazan|Şevval|Zil/i.test(body) ||
        /Ay|Güneş|numer/i.test(body)),
    body.slice(0, 200),
  );

  const afterDetail = await processAtlasMessage({
    channel: 'web',
    userId: 'web:astro-web',
    conversationId: 'astro-after',
    message: 'Merhaba',
    history: [
      { role: 'user', content: 'Genel gökyüzünü anlat. Detaylı analiz.' },
      { role: 'assistant', content: body.slice(0, 100) },
    ],
  });
  record('after analysis merhaba short again', words(afterDetail.reply) <= 10, afterDetail.reply);
} else {
  record('llm tests skipped', true, 'no OPENAI_API_KEY');
}

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) {
  console.log('Failures:', failed.map((f) => f.label).join(', '));
  process.exit(1);
}
