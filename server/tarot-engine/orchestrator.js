/**
 * Tarot orchestrator — selection SEPARATE from interpretation + depth guard.
 */

import {
  ATLAS_CLASSIC_TAROT_METHODOLOGY,
  TAROT_ENGINE_VERSION,
  DEPTH_LEVEL,
  DEFAULT_CARD_COUNT,
} from './methodology.js';
import { getCardById } from './deck.js';
import { selectCards, buildSelectionSeed } from './select-cards.js';
import {
  resolveSpreadKind,
  getPositionsForSpread,
} from './positions.js';
import { interpretCardInPosition } from './meanings.js';
import { analyzeCombinations } from './combinations.js';
import { analyzeTarotContradictions } from './contradictions.js';
import { buildTarotReply, ensureUncertaintyBoundary } from './reply-builder.js';
import { applyTarotDepthGuard } from './depth-guard.js';

/**
 * @param {string} message
 * @returns {1|2|3}
 */
export function resolveTarotDepth(message) {
  const t = String(message ?? '').toLocaleLowerCase('tr-TR');
  if (/\b(k[ıi]saca|k[ıi]sa\s+anlat|[oö]zetle|briefly|short)\b/u.test(t)) {
    return DEPTH_LEVEL.SHORT;
  }
  if (
    /detayl[ıi]|tam\s+analiz|derin(?:le[sş]tir|e|\s)|tamam[ıi]n[ıi]\s+g[oö]ster|raporla|rapor\s+ver|element|her\s+katman|full\s+analiz|\bdeep\b/u.test(
      t,
    )
  ) {
    return DEPTH_LEVEL.DEEP;
  }
  // Default first reply: Atlas prose, not a section report.
  return DEPTH_LEVEL.SHORT;
}

/**
 * Interpret an already-selected spread — NO card selection here.
 *
 * @param {{
 *   cards: import('./deck.js').TarotCard[],
 *   positions: import('./positions.js').SpreadPosition[],
 *   intention: string,
 *   spreadKind: string,
 *   selectionSeed?: string,
 * }} spread
 */
export function interpretSpread(spread) {
  const intention = String(spread.intention || 'genel okuma');
  const placed = spread.cards.map((card, i) => {
    const position = spread.positions[i] || {
      id: `p${i + 1}`,
      label: `${i + 1}. pozisyon`,
      role: 'surface',
    };
    const positional = interpretCardInPosition(card, position, {
      intention,
      spreadKind: spread.spreadKind,
    });
    return { card, position, positional };
  });

  const combinations = analyzeCombinations(placed, { intention });
  const contradictions = analyzeTarotContradictions(placed, { intention });

  const hiddenDynamic = buildHiddenDynamic(placed, combinations, contradictions, intention);
  const blindSpot = buildBlindSpot(placed, contradictions, intention);
  const strongMessage = buildStrongMessage(placed, combinations, intention);
  const growthDirection = buildGrowth(placed, contradictions);
  const synthesis = buildSynthesis(intention, strongMessage, contradictions);
  const psychologicalReading = buildPsychological(placed, contradictions);
  const alternativeReading = buildAlternative(placed, combinations);

  return {
    ok: true,
    intention,
    spreadKind: spread.spreadKind,
    selectionSeed: spread.selectionSeed || null,
    placed,
    combinations,
    contradictions,
    hiddenDynamic,
    blindSpot,
    strongMessage,
    growthDirection,
    synthesis,
    psychologicalReading,
    alternativeReading,
    methodologyId: ATLAS_CLASSIC_TAROT_METHODOLOGY.methodologyId,
  };
}

/**
 * Full run: optionally select cards, then interpret, then guard/expand.
 *
 * @param {{
 *   message?: string,
 *   intention?: string,
 *   depth?: number,
 *   focus?: string|null,
 *   exploreMore?: boolean,
 *   layersAlreadyCovered?: string[],
 *   existingCardIds?: string[]|null,
 *   existingPositions?: import('./positions.js').SpreadPosition[]|null,
 *   existingSpreadKind?: string|null,
 *   existingSeed?: string|null,
 *   forceNewDraw?: boolean,
 *   spreadKind?: string|null,
 *   conversationId?: string,
 *   userId?: string|null,
 *   spreadIndex?: number,
 *   cardCount?: number,
 *   seed?: string,
 *   skipGuard?: boolean,
 * }} input
 */
export function runTarotAnalysis(input) {
  const depth = input.depth ?? resolveTarotDepth(input.message || '');
  const intention =
    input.intention ||
    String(input.message || '').trim() ||
    'genel durum';

  const reuse =
    !input.forceNewDraw &&
    Array.isArray(input.existingCardIds) &&
    input.existingCardIds.length > 0;

  let cards;
  let positions;
  let spreadKind;
  let selectionSeed;
  let selectionMeta = null;

  if (reuse) {
    cards = input.existingCardIds
      .map((id) => getCardById(id))
      .filter(Boolean);
    if (cards.length !== input.existingCardIds.length) {
      return {
        ok: false,
        error: 'SESSION_CARDS_MISSING',
        reply: 'Önceki açılım kartları oturumda bulunamadı; yeni açılım için tekrar “aç” de.',
        depth,
        guard: null,
        engineVersion: TAROT_ENGINE_VERSION,
        methodologyId: ATLAS_CLASSIC_TAROT_METHODOLOGY.methodologyId,
      };
    }
    spreadKind =
      input.spreadKind ||
      input.existingSpreadKind ||
      resolveSpreadKind(intention);
    positions =
      input.existingPositions ||
      getPositionsForSpread(spreadKind, cards.length);
    selectionSeed = input.existingSeed || 'session-reuse';
  } else {
    spreadKind = input.spreadKind || resolveSpreadKind(intention);
    const count = input.cardCount ?? DEFAULT_CARD_COUNT;
    positions = getPositionsForSpread(spreadKind, count);
    selectionSeed =
      input.seed ||
      buildSelectionSeed({
        conversationId: input.conversationId,
        userId: input.userId,
        message: intention,
        spreadIndex: input.spreadIndex ?? 0,
      });
    // SELECT only — no interpretation
    selectionMeta = selectCards({ count, seed: selectionSeed });
    cards = selectionMeta.cards;
  }

  // INTERPRET only — selection already done
  let analysis = interpretSpread({
    cards,
    positions,
    intention,
    spreadKind,
    selectionSeed,
  });

  const buildOpts = {
    depth,
    focus: input.focus || null,
    exploreMore: Boolean(input.exploreMore),
    layersAlreadyCovered: input.layersAlreadyCovered || [],
  };

  let reply = buildTarotReply(analysis, buildOpts);
  let guard = null;
  let effectiveDepth = depth;

  if (!input.skipGuard && input.focus !== 'reveal') {
    const guardCtx = {
      requireDeep: depth >= DEPTH_LEVEL.DEEP,
      isFollowUp: Boolean(reuse && input.focus),
    };
    guard = applyTarotDepthGuard(
      { reply, analysis, depth, focus: input.focus || null },
      guardCtx,
    );

    // Focus paths: never rebuild the same focused reply at higher depth.
    // Missing uncertainty → append boundary (real remediation).
    if (input.focus) {
      if (guard.needsBoundaryFix) {
        reply = ensureUncertaintyBoundary(reply);
        guard = applyTarotDepthGuard(
          { reply, analysis, depth, focus: input.focus },
          guardCtx,
        );
      }
    } else if (
      guard.shouldExpand &&
      depth > DEPTH_LEVEL.SHORT &&
      depth < DEPTH_LEVEL.DEEP
    ) {
      // Never promote an intentional SHORT first reply into STANDARD/DEEP report.
      effectiveDepth = guard.recommendedDepth;
      reply = buildTarotReply(analysis, { ...buildOpts, depth: effectiveDepth });
      guard = applyTarotDepthGuard(
        { reply, analysis, depth: effectiveDepth, focus: null },
        { requireDeep: true, isFollowUp: false },
      );
    }

    // Final belt: if boundary still missing, append once (no rebuild loop).
    if (guard?.needsBoundaryFix) {
      reply = ensureUncertaintyBoundary(reply);
      guard = applyTarotDepthGuard(
        { reply, analysis, depth: effectiveDepth, focus: input.focus || null },
        {
          requireDeep: effectiveDepth >= DEPTH_LEVEL.DEEP,
          isFollowUp: Boolean(reuse && input.focus),
        },
      );
    }
  }

  return finalize(analysis, reply, effectiveDepth, guard, selectionMeta, reuse);
}

function finalize(analysis, reply, depth, guard, selectionMeta, reused) {
  return {
    ok: true,
    reply,
    depth,
    guard,
    analysis,
    reusedCards: Boolean(reused),
    selection: selectionMeta
      ? {
          method: selectionMeta.method,
          seed: selectionMeta.seed,
          seedHash: selectionMeta.seedHash,
          deckSize: selectionMeta.deckSize,
          cardIds: selectionMeta.cards.map((c) => c.id),
          cardNames: selectionMeta.cards.map((c) => c.name),
        }
      : {
          method: 'session-reuse',
          seed: analysis.selectionSeed,
          cardIds: analysis.placed.map((p) => p.card.id),
          cardNames: analysis.placed.map((p) => p.card.name),
        },
    engineVersion: TAROT_ENGINE_VERSION,
    methodologyId: ATLAS_CLASSIC_TAROT_METHODOLOGY.methodologyId,
    methodologyVersion: ATLAS_CLASSIC_TAROT_METHODOLOGY.methodologyVersion,
    school: ATLAS_CLASSIC_TAROT_METHODOLOGY.school,
  };
}

function buildHiddenDynamic(placed, combinations, contradictions, intention) {
  if (contradictions.tensions[0]) {
    return (
      `Gizli dinamik, yüzeydeki karttan çok gerilimde: ${contradictions.tensions[0].question} ` +
      `${contradictions.tensions[0].reading}`
    );
  }
  const hidden = placed.find((p) => p.position.role === 'hidden');
  if (hidden) {
    return (
      `Perde arkasında ${hidden.card.name} duruyor: ${hidden.card.theme}. ` +
      (intention ? `«${intention}» niyetinde bu katman çoğu zaman asıl cevaba daha yakındır.` : '')
    );
  }
  return combinations.commonTheme;
}

function buildBlindSpot(placed, contradictions, intention) {
  if (contradictions.tensions.some((t) => t.id === 'warmth-defense')) {
    return (
      'Kör nokta: sıcaklığı samimiyet, mesafeyi ilgisizlik sanmak. ' +
      'Açılım ikisini birden taşıyor; biri diğerini iptal etmez.'
    );
  }
  if (contradictions.tensions.some((t) => t.id === 'clarity-fog')) {
    return (
      'Kör nokta: net karar isteğinin, henüz netleşmemiş bilgiyi zorla net göstermesi. ' +
      'Kararsızlık bazen bilgelik, bazen kaçınmadır — ikisini ayırmak gerekir.'
    );
  }
  const surface = placed[0];
  return (
    `Kör nokta: yalnızca ${surface?.card.name || 'ilk kart'} üzerinden niyeti okumak. ` +
    `Komşu kartlar ve gizli pozisyon olmadan «${intention || 'soru'}» yarım kalır.`
  );
}

function buildStrongMessage(placed, combinations, intention) {
  const names = placed.map((p) => p.card.name).join(' + ');
  return (
    `Güçlü mesaj (${names}): ${softenTheme(combinations.commonTheme)} ` +
    (intention
      ? `Bu, «${intention}» sorusuna tek kart ezberiyle değil, kartların birlikte verdiği yönle yanıt verir.`
      : 'Tekil kart anlamı değil; kartların birlikte verdiği yön cevaptır.')
  );
}

function softenTheme(theme) {
  return String(theme || '')
    .replace(/^Ortak tema:\s*/i, '')
    .replace(/\bbüyük\s+arkana\s+ağırlığı\b/gi, 'güçlü bir ana tema')
    .replace(/\bbirlikte\s+kurulan\s+örüntü\b/gi, 'kartların birlikte verdiği yön')
    .trim();
}

function buildGrowth(placed, contradictions) {
  if (contradictions.tensions.some((t) => t.id === 'active-passive')) {
    return (
      'Gelişim yönü: yaklaşma ve korunmayı düşman kutuplar gibi görmemek; ' +
      'hangi katmanın görünür, hangisinin içeride kaldığını ayırt etmek.'
    );
  }
  const outcome = placed.find((p) => p.position.role === 'outcome') || placed[placed.length - 1];
  return (
    `Gelişim yönü: ${outcome.card.name} katmanındaki «${outcome.card.theme}» bilgisini ` +
    'eyleme çevirmeden önce gizli pozisyonu da hesaba katmak.'
  );
}

function buildSynthesis(intention, strongMessage, contradictions) {
  const tensionBit = contradictions.tensions[0]
    ? ` Çelişki yok sayılmaz: ${contradictions.tensions[0].question}`
    : '';
  return (
    `Sonuç: ${strongMessage}${tensionBit} ` +
    `Niyet («${intention}») merkeze alındığında cevap, kartları tek tek ezberlemekten değil ` +
    'birlikte nasıl konuştuklarından çıkar.'
  );
}

function buildPsychological(placed, contradictions) {
  return (
    `Psikolojik okuma: yüzeyde ${placed[0]?.card.theme || 'görünen'} varken, ` +
    `içeride ${(placed[1] || placed[0])?.card.theme || 'gizli'} işliyor olabilir. ` +
    (contradictions.tensions[0]
      ? `Savunma ve yakınlık aynı psyche içinde co-exist edebilir — ${contradictions.tensions[0].id}.`
      : 'Tek bir duygusal nota indirgemek açılımı zayıflatır.')
  );
}

function buildAlternative(placed, combinations) {
  return (
    `Alternatif yorum: kartlar bir “sonuç kehaneti” yerine, ` +
    `şu anki iç müzakereyi gösteriyor olabilir — ${combinations.neighborStory || combinations.commonTheme}`
  );
}
