/**
 * Hüseyin first-turn / follow-up live smoke checklist.
 * Deterministic engines run for real; astrology LLM path is mocked for CI stability.
 *
 * Run: node scripts/smoke-huseyin-first-turn.mjs
 */
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';

import { performance } from 'perf_hooks';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { _resetAllNumerologySessions } from '../server/numerology-engine/index.js';
import { _resetAllTarotSessions } from '../server/tarot-engine/index.js';

const scenarios = [];

function record(row) {
  scenarios.push(row);
  const flag = row.ok ? '✓' : '✗';
  console.log(
    `${flag} ${row.name} | ${row.durationMs}ms | engine=${row.engine} | llmCalls=${row.llmCalls}` +
      (row.detail ? ` | ${row.detail}` : ''),
  );
  if (!row.ok) console.log('   fail:', row.reason);
}

async function runScenario(name, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    const timing = result?.data?.requestTiming;
    record({
      name,
      ok: Boolean(result?.ok),
      durationMs,
      engine: result?.engine || 'n/a',
      llmCalls: timing?.llmCallCount ?? result?.llmCalls ?? 'n/a',
      detail: result?.detail || '',
      reason: result?.reason || '',
    });
  } catch (err) {
    record({
      name,
      ok: false,
      durationMs: Math.round((performance.now() - t0) * 100) / 100,
      engine: 'error',
      llmCalls: 'n/a',
      detail: '',
      reason: err?.message || String(err),
    });
  }
}

_resetAllNumerologySessions();
_resetAllTarotSessions();

const userId = 'telegram:smoke-huseyin';
const conversationId = 'smoke-huseyin-dm';

await runScenario('1. kısa numeroloji (yaşam yolu kaç?)', async () => {
  const out = await processAtlasMessage({
    channel: 'telegram',
    userId,
    conversationId,
    message: '27.01.1986 — benim yaşam yolu sayım kaç?',
    history: [],
    metadata: { isGroup: false, telegramFromId: 'smoke-huseyin' },
  });
  const reply = out.reply || '';
  const ok =
    out.engine === 'numerology-engine' &&
    /yaşam yolu|7\b/i.test(reply) &&
    reply.length < 900 &&
    /gölge|okuma|kişisel yıl|frekans/i.test(reply);
  return {
    ok,
    engine: out.engine,
    data: out.data,
    detail: `len=${reply.length} depth=${out.data?.depth}`,
    reason: ok ? '' : 'expected short L1 numerology with number+meaning',
  };
});

await runScenario('2. detaylı numeroloji analizi', async () => {
  _resetAllNumerologySessions();
  const out = await processAtlasMessage({
    channel: 'telegram',
    userId,
    conversationId: `${conversationId}-detail`,
    message: '27.01.1986 Numerolojimi detaylı yorumla.',
    history: [],
    metadata: { isGroup: false, telegramFromId: 'smoke-huseyin' },
  });
  const reply = out.reply || '';
  const ok =
    out.engine === 'numerology-engine' &&
    out.data?.depth >= 3 &&
    /yaşam yolu/i.test(reply) &&
    /doğum günü/i.test(reply) &&
    /döngü|kişisel yıl/i.test(reply) &&
    /güçlü/i.test(reply) &&
    /gölge/i.test(reply) &&
    /zirve|mücadele/i.test(reply);
  return {
    ok,
    engine: out.engine,
    data: out.data,
    detail: `len=${reply.length} depth=${out.data?.depth}`,
    reason: ok ? '' : 'expected L3 first-turn layers',
  };
});

await runScenario('3. astroloji sentezi (mocked LLM)', async () => {
  const out = await processAtlasMessage(
    {
      channel: 'telegram',
      userId,
      conversationId: `${conversationId}-astro`,
      message: 'Genel gökyüzü analizini anlat; transit ve dönemsel etkiyi sentezle',
      history: [],
      metadata: { isGroup: false, telegramFromId: 'smoke-huseyin' },
    },
    {
      callOpenAI: async ({ systemPrompt, userPrompt }) => {
        const hasAstro =
          /ASTROLOGY FLOW|VERIFIED|ephemeris|Ay|gökyüz/i.test(
            String(systemPrompt || '') + String(userPrompt || ''),
          );
        const content = [
          'Ana tema: iletişim ve görünürlük alanında hızlanan bir netleşme.',
          'Transit katmanı: günün gökyüzü verisine bağlı olarak kolektif atmosfer daha hareketli.',
          'Sentez: sembolik okuma, tek burç tanımı yerine ortak tema + dikkat alanı üretir.',
          'Gölge: acele kesin sonuç çıkarmak; bu çerçeve olay kehaneti değildir.',
          'Dönemsel not: bir alanı sadeleştirip tek adım seçmek faydalı.',
        ].join(' ');
        return {
          content: hasAstro ? content : 'Eksik astroloji bağlamı.',
          model: 'mock-astro',
          provider: 'mock',
          tokensUsed: 80,
          costUsd: 0,
          latencyMs: 2,
        };
      },
    },
  );
  const reply = out.reply || '';
  const ok =
    /tema|transit|gölge|sembolik|gökyüz/i.test(reply) &&
    out.engine !== 'conversation-style' &&
    (out.engine === 'astrology-analysis' ||
      out.data?.astrologyFlowVersion ||
      Number(out.data?.requestTiming?.llmCallCount || 0) >= 1);
  return {
    ok,
    engine: out.engine,
    data: out.data,
    detail: `len=${reply.length} intent=${out.intent}`,
    reason: ok ? '' : 'expected astrology analysis path',
  };
});

let tarotCardIds = [];
await runScenario('4. tarot açılım + kör nokta follow-up', async () => {
  _resetAllTarotSessions();
  const spread = await processAtlasMessage({
    channel: 'telegram',
    userId,
    conversationId: `${conversationId}-tarot`,
    message: 'Aklımdaki kişinin duygularına üç kart aç',
    history: [],
    metadata: { isGroup: false, telegramFromId: 'smoke-huseyin' },
  });
  tarotCardIds = (spread.data?.cards || []).map((c) => c.id);
  const blind = await processAtlasMessage({
    channel: 'telegram',
    userId,
    conversationId: `${conversationId}-tarot`,
    message: 'Kör nokta?',
    history: [
      { role: 'user', content: 'Aklımdaki kişinin duygularına üç kart aç' },
      { role: 'assistant', content: spread.reply || '' },
    ],
    metadata: { isGroup: false, telegramFromId: 'smoke-huseyin' },
  });
  const blindIds = (blind.data?.cards || []).map((c) => c.id);
  const same =
    tarotCardIds.length === 3 &&
    tarotCardIds.length === blindIds.length &&
    tarotCardIds.every((id, i) => id === blindIds[i]);
  const ok =
    spread.engine === 'tarot-engine' &&
    blind.engine === 'tarot-engine' &&
    blind.data?.reusedCards === true &&
    same &&
    /k[oö]r\s+nokta|sembolik/i.test(blind.reply || '');
  return {
    ok,
    engine: blind.engine,
    data: blind.data,
    detail: `cards=${tarotCardIds.join(',')} reused=${blind.data?.reusedCards}`,
    reason: ok ? '' : 'follow-up must reuse same cardIds',
  };
});

await runScenario('5. “Başka ne görüyorsun?” follow-up (numeroloji)', async () => {
  _resetAllNumerologySessions();
  const first = await processAtlasMessage({
    channel: 'telegram',
    userId,
    conversationId: `${conversationId}-explore`,
    message: '27.01.1986 numerolojimi anlat',
    history: [],
    metadata: { isGroup: false, telegramFromId: 'smoke-huseyin' },
  });
  const follow = await processAtlasMessage({
    channel: 'telegram',
    userId,
    conversationId: `${conversationId}-explore`,
    message: 'Başka ne görüyorsun?',
    history: [
      { role: 'user', content: '27.01.1986 numerolojimi anlat' },
      { role: 'assistant', content: first.reply || '' },
    ],
    metadata: { isGroup: false, telegramFromId: 'smoke-huseyin' },
  });
  const ok =
    follow.engine === 'numerology-engine' &&
    follow.reply !== first.reply &&
    /zirve|mücadele|eksik|titreşim|ad soyad|ifade/i.test(follow.reply || '');
  return {
    ok,
    engine: follow.engine,
    data: follow.data,
    detail: `firstLen=${(first.reply || '').length} followLen=${(follow.reply || '').length}`,
    reason: ok ? '' : 'follow-up must open a new layer without full repeat',
  };
});

await runScenario('6. cevap süresi ölçümü (timing telemetry)', async () => {
  const out = await processAtlasMessage({
    channel: 'telegram',
    userId,
    conversationId: `${conversationId}-timing`,
    message: '27.01.1986 numeroloji analizi yap',
    history: [],
    metadata: { isGroup: false, telegramFromId: 'smoke-huseyin' },
  });
  const timing = out.data?.requestTiming;
  const ok =
    Boolean(timing?.requestId) &&
    Number.isFinite(timing?.totalDurationMs) &&
    timing.llmCallCount === 0 &&
    (timing.phases || []).some((p) => p.name === 'numerology_engine');
  return {
    ok,
    engine: out.engine,
    data: out.data,
    detail: `total=${timing?.totalDurationMs}ms phases=${(timing?.phases || [])
      .map((p) => `${p.name}=${p.durationMs}`)
      .join(',')}`,
    reason: ok ? '' : 'missing requestTiming telemetry',
  };
});

const failed = scenarios.filter((s) => !s.ok);
console.log('');
console.log(`Hüseyin smoke: ${scenarios.length - failed.length}/${scenarios.length} passed`);
if (failed.length) {
  process.exit(1);
}
