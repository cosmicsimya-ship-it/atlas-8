/**
 * Dream orchestrator — extract → layered interpret → reply → depth guard.
 */

import {
  ATLAS_DREAM_METHODOLOGY,
  DREAM_ENGINE_VERSION,
  DEPTH_LEVEL,
} from './methodology.js';
import {
  extractDreamLayers,
  hasDreamNarrative,
  extractDreamNarrative,
} from './extract.js';
import { interpretSymbolInContext, buildPsychologicalLayer, buildClassicalLayer } from './meanings.js';
import { analyzeSymbolCombinations } from './combinations.js';
import { analyzeDreamContradictions } from './contradictions.js';
import { matchJungArchetypes } from './archetypes.js';
import { resolvePersonalContext } from './personal-context.js';
import { buildDreamReply, ensureUncertaintyBoundary } from './reply-builder.js';
import { applyDreamDepthGuard } from './depth-guard.js';

/**
 * @param {string} message
 * @returns {1|2|3}
 */
export function resolveDreamDepth(message) {
  const t = String(message ?? '').toLocaleLowerCase('tr-TR');
  if (/\b(k[ıi]saca|k[ıi]sa\s+anlat|[oö]zetle|briefly|short)\b/u.test(t)) {
    return DEPTH_LEVEL.SHORT;
  }
  if (
    /detayl[ıi]|ayr[ıi]nt[ıi]l[ıi]|tam\s+analiz|derin(?:le[sş]tir|e|\s)|tamam[ıi]n[ıi]\s+g[oö]ster|raporla|rapor\s+ver|her\s+katman|full\s+analiz|\bdeep\b|jung|klasik|psikolojik/u.test(
      t,
    )
  ) {
    return DEPTH_LEVEL.DEEP;
  }
  // Default first reply: Atlas prose, not a section report.
  return DEPTH_LEVEL.SHORT;
}

/**
 * Interpret already-extracted dream layers — no re-extraction here when layers provided.
 *
 * @param {{
 *   narrative: string,
 *   statedSymbols?: string,
 *   statedEmotion?: string,
 *   wakingEmotion?: string,
 *   recurring?: boolean|null,
 *   userId?: string|null,
 *   history?: { role: string, content: string }[],
 *   existingLayers?: object|null,
 * }} input
 */
export function interpretDream(input) {
  const layers =
    input.existingLayers ||
    extractDreamLayers({
      narrative: input.narrative,
      statedSymbols: input.statedSymbols,
      statedEmotion: input.statedEmotion,
      wakingEmotion: input.wakingEmotion,
      recurring: input.recurring,
    });

  if (!hasDreamNarrative(layers.narrative) && !(layers.symbols?.length >= 2)) {
    return {
      ok: false,
      needsClarify: true,
      methodologyId: ATLAS_DREAM_METHODOLOGY.methodologyId,
    };
  }

  const ctx = {
    emotions: layers.emotions,
    narrative: layers.narrativeAnalysis,
    recurring: layers.recurring,
  };

  const symbolReadings = (layers.symbols || []).map((s) =>
    interpretSymbolInContext(s, ctx),
  );

  const combinations = analyzeSymbolCombinations(layers.symbols, ctx);
  const contradictions = analyzeDreamContradictions(layers.symbols, ctx);
  const jungArchetypes = matchJungArchetypes({
    symbols: layers.symbols,
    emotions: (layers.emotions || []).map((e) => e.label),
    narrative: layers.narrativeAnalysis,
  });
  const classicalReading = buildClassicalLayer(layers.symbols);
  const psychologicalReading = buildPsychologicalLayer(layers);
  const personalContext = resolvePersonalContext({
    symbols: layers.symbols,
    userId: input.userId,
    history: input.history,
  });

  const emotionReading = buildEmotionReading(layers);
  const narrativeReading = layers.narrativeAnalysis?.summary || '';
  const hiddenDynamic = buildHiddenDynamic(layers, combinations, contradictions, jungArchetypes);
  const blindSpot = buildBlindSpot(layers, contradictions);
  const strongMessage = buildStrongMessage(layers, combinations, emotionReading);
  const growthDirection = buildGrowth(layers, contradictions, personalContext);
  const synthesis = buildSynthesis(layers, strongMessage, contradictions);
  const alternativeReading = buildAlternative(layers, combinations);

  return {
    ok: true,
    needsClarify: false,
    narrative: layers.narrative,
    symbols: layers.symbols,
    emotions: layers.emotions,
    narrativeAnalysis: layers.narrativeAnalysis,
    recurring: layers.recurring,
    symbolReadings,
    combinations,
    contradictions,
    jungArchetypes,
    classicalReading,
    psychologicalReading,
    personalContext,
    emotionReading,
    narrativeReading,
    hiddenDynamic,
    blindSpot,
    strongMessage,
    growthDirection,
    synthesis,
    alternativeReading,
    methodologyId: ATLAS_DREAM_METHODOLOGY.methodologyId,
  };
}

/**
 * Full run: clarify or analyze + guard/expand.
 *
 * @param {{
 *   message?: string,
 *   narrative?: string,
 *   statedSymbols?: string,
 *   statedEmotion?: string,
 *   wakingEmotion?: string,
 *   recurring?: boolean|null,
 *   depth?: number,
 *   focus?: string|null,
 *   exploreMore?: boolean,
 *   layersAlreadyCovered?: string[],
 *   existingAnalysis?: object|null,
 *   forceReanalyze?: boolean,
 *   userId?: string|null,
 *   history?: { role: string, content: string }[],
 *   conversationId?: string,
 *   skipGuard?: boolean,
 *   skipClarify?: boolean,
 * }} input
 */
export function runDreamAnalysis(input) {
  const depth = input.depth ?? resolveDreamDepth(input.message || '');
  const narrative =
    input.narrative ||
    extractDreamNarrative(input.message || '') ||
    '';

  // Reuse prior analysis for follow-ups
  if (
    !input.forceReanalyze &&
    input.existingAnalysis?.ok &&
    input.focus &&
    input.focus !== 'analyze'
  ) {
    const analysis = input.existingAnalysis;
    let reply = buildDreamReply(analysis, {
      depth,
      focus: input.focus,
      exploreMore: Boolean(input.exploreMore),
      layersAlreadyCovered: input.layersAlreadyCovered || [],
    });
    let guard = null;
    if (!input.skipGuard) {
      guard = applyDreamDepthGuard(
        { reply, analysis, depth, focus: input.focus },
        { isFollowUp: true, requireDeep: depth >= DEPTH_LEVEL.DEEP },
      );
      if (guard.needsBoundaryFix) {
        reply = ensureUncertaintyBoundary(reply);
        guard = applyDreamDepthGuard(
          { reply, analysis, depth, focus: input.focus },
          { isFollowUp: true },
        );
      }
    }
    return finalize(analysis, reply, depth, guard, true);
  }

  const analysis = interpretDream({
    narrative,
    statedSymbols: input.statedSymbols,
    statedEmotion: input.statedEmotion,
    wakingEmotion: input.wakingEmotion,
    recurring: input.recurring,
    userId: input.userId,
    history: input.history,
    existingLayers: input.existingAnalysis?.ok
      ? {
          narrative: input.existingAnalysis.narrative,
          symbols: input.existingAnalysis.symbols,
          emotions: input.existingAnalysis.emotions,
          narrativeAnalysis: input.existingAnalysis.narrativeAnalysis,
          recurring: input.existingAnalysis.recurring,
        }
      : null,
  });

  if (!analysis.ok) {
    const reply = buildDreamReply(analysis, { focus: 'clarify' });
    return {
      ok: true,
      clarified: true,
      reply,
      depth,
      guard: null,
      analysis,
      reusedDream: false,
      engineVersion: DREAM_ENGINE_VERSION,
      methodologyId: ATLAS_DREAM_METHODOLOGY.methodologyId,
      methodologyVersion: ATLAS_DREAM_METHODOLOGY.methodologyVersion,
      school: ATLAS_DREAM_METHODOLOGY.school,
    };
  }

  const buildOpts = {
    depth,
    focus: input.focus && input.focus !== 'analyze' ? input.focus : null,
    exploreMore: Boolean(input.exploreMore),
    layersAlreadyCovered: input.layersAlreadyCovered || [],
  };

  let reply = buildDreamReply(analysis, buildOpts);
  let guard = null;
  let effectiveDepth = depth;

  if (!input.skipGuard && buildOpts.focus !== 'clarify') {
    const guardCtx = {
      requireDeep: depth >= DEPTH_LEVEL.DEEP,
      isFollowUp: Boolean(input.existingAnalysis?.ok && input.focus),
    };
    guard = applyDreamDepthGuard(
      { reply, analysis, depth, focus: buildOpts.focus },
      guardCtx,
    );

    if (buildOpts.focus) {
      if (guard.needsBoundaryFix) {
        reply = ensureUncertaintyBoundary(reply);
        guard = applyDreamDepthGuard(
          { reply, analysis, depth, focus: buildOpts.focus },
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
      reply = buildDreamReply(analysis, { ...buildOpts, depth: effectiveDepth });
      guard = applyDreamDepthGuard(
        { reply, analysis, depth: effectiveDepth, focus: null },
        { requireDeep: true, isFollowUp: false },
      );
    }

    if (guard?.needsBoundaryFix) {
      reply = ensureUncertaintyBoundary(reply);
      guard = applyDreamDepthGuard(
        { reply, analysis, depth: effectiveDepth, focus: buildOpts.focus },
        {
          requireDeep: effectiveDepth >= DEPTH_LEVEL.DEEP,
          isFollowUp: Boolean(input.existingAnalysis?.ok && input.focus),
        },
      );
    }
  }

  return finalize(analysis, reply, effectiveDepth, guard, Boolean(input.existingAnalysis?.ok));
}

function finalize(analysis, reply, depth, guard, reused) {
  return {
    ok: true,
    clarified: false,
    reply,
    depth,
    guard,
    analysis,
    reusedDream: Boolean(reused),
    engineVersion: DREAM_ENGINE_VERSION,
    methodologyId: ATLAS_DREAM_METHODOLOGY.methodologyId,
    methodologyVersion: ATLAS_DREAM_METHODOLOGY.methodologyVersion,
    school: ATLAS_DREAM_METHODOLOGY.school,
  };
}

function buildEmotionReading(layers) {
  const top = layers.emotions?.[0];
  const waking = layers.wakingEmotion;
  const stated = layers.statedEmotion;
  if (!top && !waking && !stated) {
    return (
      'Duygu katmanı metinden net çıkarılamadı. ' +
      'Yorum yine de sembol ve olay örgüsüyle ilerler; istersen rüyada ne hissettiğini ayrıca söyle.'
    );
  }
  const bits = [];
  if (top) bits.push(`merkez duygu «${top.label}»`);
  if (stated) bits.push(`senin ifade ettiğin his «${stated}»`);
  if (waking) bits.push(`uyanıştaki ilk his «${waking}»`);
  return (
    `Duygu katmanı: Rüya yorumu sembolden çok duygu merkezli ilerler — ${bits.join('; ')}. ` +
    'Bu, bilinçaltında o hissin taşıdığı çözülmemiş veya geçiş halindeki bir temayı işaret ediyor olabilir. Bu yorum kesin değildir.'
  );
}

function buildHiddenDynamic(layers, combinations, contradictions, jung) {
  if (contradictions.tensions[0]) {
    return (
      `Gizli dinamik, yüzeydeki sembolden çok gerilimde: ${contradictions.tensions[0].question} ` +
      `${contradictions.tensions[0].reading}`
    );
  }
  if (jung?.[0]) {
    return (
      `Gizli dinamik Jung çerçevesinde «${jung[0].name}» ile yankılanabilir: ${jung[0].reading}`
    );
  }
  return combinations.commonTheme;
}

function buildBlindSpot(layers, contradictions) {
  if (contradictions.tensions.some((t) => t.id === 'fear-hope')) {
    return (
      'Kör nokta: yalnızca korkuyu veya yalnızca umudu “asıl duygu” sanmak. ' +
      'İkisi birden taşıyorsa, geçişin kendisi mesajdır.'
    );
  }
  if (contradictions.tensions.some((t) => t.id === 'end-begin')) {
    return (
      'Kör nokta: ölüm/bitiş sembolünü fiziksel kehanet sanmak. ' +
      'Burada dönüşüm motifi daha olasıdır — yine de kesin değildir.'
    );
  }
  const first = layers.symbols?.[0]?.name;
  return (
    `Kör nokta: yalnızca ${first || 'tek bir sembol'} üzerinden hüküm vermek. ` +
    'Duygu ve olay örgüsü olmadan rüya yarım kalır.'
  );
}

function buildStrongMessage(layers, combinations, emotionReading) {
  const names = (layers.symbols || []).map((s) => s.name).join(' + ') || 'duygu-anlatı';
  return (
    `Güçlü vurgu (${names}): ${combinations.commonTheme} ` +
    'Tekil sembol sözlüğü değil; duygu + anlatı + sembol birlikte cevaptır. ' +
    emotionReading.slice(0, 120) +
    '…'
  );
}

function buildGrowth(layers, contradictions, personal) {
  if (personal?.links?.[0]) {
    return (
      `Uyanık hayat daveti: «${personal.links[0].theme}» ile rüya sembolü arasında kurulan bağa nazikçe bakmak; ` +
      'aceleyle “anlamı bu” demeden, hangi duygunun tekrar ettiğini izlemek.'
    );
  }
  if (contradictions.tensions.some((t) => t.id === 'flee-find' || t.id === 'fear-hope')) {
    return (
      'Gelişim yönü: kaçılan ile arananı düşman kutuplar gibi görmemek; ' +
      'yüzleşmenin dozu ve zamanı üzerine düşünmek.'
    );
  }
  const emotion = layers.emotions?.[0]?.label;
  return (
    `Gelişim yönü: uyanık hayatta «${emotion || 'öne çıkan duygu'}»nun hangi durumda tekrar ettiğini fark etmek; ` +
    'rüyayı emir değil, davet gibi tutmak.'
  );
}

function buildSynthesis(layers, strongMessage, contradictions) {
  const tensionBit = contradictions.tensions[0]
    ? ` Çelişki yok sayılmaz: ${contradictions.tensions[0].question}`
    : '';
  return (
    `Sonuç: ${strongMessage}${tensionBit} ` +
    'Rüyanın anlamı “şu” diye tek cümleye indirgenmez; olası sembolik anlamlar katman katman açılır.'
  );
}

function buildAlternative(layers, combinations) {
  return (
    `Alternatif yorum: semboller bir “kehanet” yerine, ` +
    `şu anki iç müzakereyi gösteriyor olabilir — ${combinations.neighborStory || combinations.commonTheme}`
  );
}
