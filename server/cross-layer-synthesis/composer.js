/**
 * Cross-layer synthesis composer — deterministic, explainable, non-forcing.
 */

import { CROSS_LAYER_SYNTHESIS_VERSION, RELATIONSHIP_LABELS_TR } from './schema.js';
import { ensureNormalizedLayer } from './normalize.js';
import { classifyAllPairs } from './relationship.js';
import { evaluateFaithSafety, softenFearLanguage } from './safety.js';
import { evaluateSynthesisClaim, sanitizeCertaintyLanguage } from './certainty-filter.js';
import { getSessionSynthesisHints } from './user-example.js';
import { intersectStrings, extractThemeIds } from './theme-lexicon.js';

/**
 * @param {import('./schema.js').NormalizedLayer} layer
 */
function summarizeLayer(layer) {
  const themeText = layer.themes.length ? layer.themes.join(', ') : 'tema belirtilmedi';
  const interp = layer.interpretation
    ? softenFearLanguage(layer.interpretation).slice(0, 280)
    : 'yorum yok (yalnızca veri/sınırlar)';
  return {
    layerId: layer.layerId,
    layerType: layer.layerType,
    source: layer.source,
    method: layer.method,
    status: layer.status,
    confidence: layer.confidence,
    themes: layer.themes,
    summary: `${layer.layerId} (${layer.layerType}): kaynak=${layer.source}; yöntem=${layer.method}; temalar=${themeText}; ${interp}`,
    visibility: layer.visibility,
    citationsOrReferences: layer.citationsOrReferences,
    cautions: layer.cautions,
    limitations: layer.limitations,
    computedFactsPresent: layer.normalizedFacts != null,
    interpretationPresent: Boolean(layer.interpretation),
  };
}

function pickPrimaryRelationship(pairs) {
  if (!pairs.length) return null;
  const priority = [
    'contradictory',
    'tension',
    'balancing',
    'same_theme_different_angle',
    'complementing',
    'supporting',
    'independent',
    'insufficient_data',
  ];
  for (const type of priority) {
    const hit = pairs.find((p) => p.type === type);
    if (hit) return hit;
  }
  return pairs[0];
}

function buildCommonTheme(layers, pairs) {
  const usable = layers.filter((l) => l.status === 'success' || l.status === 'partial');
  if (usable.length < 2) {
    return {
      text: null,
      note: 'Ortak tema için en az iki kullanılabilir katman gerekir.',
    };
  }

  let shared = extractThemeIds(usable[0].themes);
  for (let i = 1; i < usable.length; i += 1) {
    shared = intersectStrings(shared, extractThemeIds(usable[i].themes));
  }

  const relationalShared = [
    ...new Set(pairs.flatMap((p) => [...(p.sharedThemeIds ?? []), ...(p.sharedPhrases ?? [])])),
  ];

  if (shared.length === 0 && relationalShared.length === 0) {
    return {
      text: null,
      note: 'Ortak tema bulunamadı; katmanlar ayrı özetlenir.',
    };
  }

  const labels = shared.length ? shared : relationalShared;
  return {
    text: `Ortak düşünme alanı: ${labels.join(', ')}. Bu, katmanların aynı yönteme ait olduğu veya birbirini doğruladığı anlamına gelmez.`,
    note: null,
    themeIds: labels,
  };
}

function buildWhy(relationship, sessionHints) {
  if (!relationship) {
    return 'İlişki kurulamadı.';
  }
  let why = relationship.reason;
  if (sessionHints?.hasHints && sessionHints.preferredRelationshipTypes.includes(relationship.type)) {
    why +=
      ' Bu oturumda paylaştığınız sentez örneğindeki ilişki türüyle uyumlu bir okuma tercih edildi; örneğiniz aynen kopyalanmadı.';
  } else if (sessionHints?.hasHints) {
    why +=
      ' Oturum örneğiniz referans alındı ancak otomatik olarak onaylanmadı; mevcut veri kendi kanıtına göre sınıflandırıldı.';
  }
  return why;
}

function buildReflectionQuestion(relationship, commonTheme) {
  if (!relationship || relationship.type === 'insufficient_data') {
    return 'Hangi ek bilgi (tarih, bağlam, güvenilir meal kaynağı veya net tema) bu katmanları daha adil karşılaştırmamıza yardım eder?';
  }
  if (relationship.type === 'tension' || relationship.type === 'contradictory') {
    return 'Bu gerilimde sizin için asıl mesele hız mı, yoksa kararın sonuçlarını tartmak mı?';
  }
  if (relationship.type === 'balancing') {
    return 'Dengeyi korumak için bugün hangi küçük ölçü (beklemek, sormak, sınır koymak) size daha dürüst geliyor?';
  }
  if (commonTheme?.themeIds?.includes('responsibility') || commonTheme?.themeIds?.includes('decision')) {
    return 'Karar vermeden önce hangi sonucu bilerek göze alıyorsunuz, hangisini henüz netleştirmediniz?';
  }
  return 'Bu katmanları yan yana koyunca sizin için hangi soru daha netleşti?';
}

function buildLimits(layers, pairs, safety) {
  const limits = [
    'Katmanlar birbirine zorla uydurulmaz; ortak okuma olasılıktır, kanıt değildir.',
    'Kur’an referansı astroloji/numeroloji ile “doğrulanmış” sayılmaz.',
  ];
  for (const layer of layers) {
    limits.push(...(layer.limitations ?? []).slice(0, 2));
  }
  if (pairs.some((p) => p.type === 'insufficient_data')) {
    limits.push('Bazı katman çiftlerinde güvenilir örüntü için veri yetersiz.');
  }
  limits.push(...safety.boundaryNotes.slice(0, 3));
  return [...new Set(limits)];
}

function buildSourceVisibility(layers) {
  return layers.map((layer) => ({
    layerId: layer.layerId,
    source: layer.source,
    method: layer.method,
    computed: layer.visibility.computed,
    interpreted: layer.visibility.interpreted,
    symbolic: layer.visibility.symbolic,
    separationNote:
      'Hesaplanan (veri/hesap), yorumlanan (anlamlandırma) ve sembolik (eşleme/okuma yöntemi) alanlar ayrı tutulur.',
  }));
}

/**
 * Compose user-facing synthesis sections (Turkish).
 * @param {object} input
 * @param {import('./schema.js').NormalizedLayer[]} input.layers
 * @param {string} [input.userMessage]
 * @param {string} [input.sessionId]
 * @param {boolean} [input.userAskedToCombine]
 */
export function composeSynthesis(input) {
  const rawLayers = Array.isArray(input?.layers) ? input.layers : [];
  const layers = rawLayers.map(ensureNormalizedLayer);
  const successful = layers.filter((l) => l.status === 'success' || l.status === 'partial');
  const failed = layers.filter((l) => l.status === 'error' || l.status === 'unavailable');

  const safety = evaluateFaithSafety(input?.userMessage ?? '', layers);
  const sessionHints = getSessionSynthesisHints(input?.sessionId ?? 'anonymous');

  if (successful.length === 0) {
    return {
      version: CROSS_LAYER_SYNTHESIS_VERSION,
      status: 'insufficient_data',
      sections: {
        sourceSummaries: layers.map(summarizeLayer),
        commonTheme: null,
        balanceOrTension: null,
        whyRelated: 'Kullanılabilir katman yok.',
        limits: buildLimits(layers, [], safety),
        reflectionQuestion: buildReflectionQuestion(null, null),
        additionalDataRequest: 'En az bir başarılı katman çıktısı gerekli.',
      },
      relationships: [],
      sourceVisibility: buildSourceVisibility(layers),
      confidence: 'insufficient',
      partial: true,
      failedLayers: failed.map((l) => l.layerId),
      safety,
      prose: formatSynthesisProse({
        sourceSummaries: layers.map(summarizeLayer),
        commonTheme: null,
        balanceOrTension: null,
        whyRelated: 'Kullanılabilir katman yok.',
        limits: buildLimits(layers, [], safety),
        reflectionQuestion: buildReflectionQuestion(null, null),
        additionalDataRequest: 'En az bir başarılı katman çıktısı gerekli.',
      }),
    };
  }

  const pairs = classifyAllPairs(successful.length >= 2 ? successful : layers);
  const primary = pickPrimaryRelationship(pairs.filter((p) => successful.some((l) => l.layerId === p.layerAId) && successful.some((l) => l.layerId === p.layerBId)));
  const commonTheme = buildCommonTheme(successful, pairs);

  let balanceOrTension = null;
  if (primary && (primary.type === 'tension' || primary.type === 'contradictory' || primary.type === 'balancing')) {
    const a = successful.find((l) => l.layerId === primary.layerAId);
    const b = successful.find((l) => l.layerId === primary.layerBId);
    balanceOrTension = {
      type: primary.type,
      labelTr: primary.labelTr,
      layerA: a ? `${a.layerId}: ${(a.themes || []).join(', ') || a.interpretation || '—'}` : primary.layerAId,
      layerB: b ? `${b.layerId}: ${(b.themes || []).join(', ') || b.interpretation || '—'}` : primary.layerBId,
      tensionWhere: primary.reason,
      whyMeaningful:
        primary.type === 'balancing'
          ? 'Farklı hız veya vurgu, tek doğru seçmek zorunda olmadan ölçü aramayı düşündürebilir.'
          : 'Gerilim hata değildir; karar öncesi hangi değerin baskın geldiğini görmeyi kolaylaştırabilir.',
    };
  } else if (primary && (primary.type === 'complementing' || primary.type === 'same_theme_different_angle' || primary.type === 'supporting')) {
    balanceOrTension = {
      type: primary.type,
      labelTr: primary.labelTr,
      layerA: primary.layerAId,
      layerB: primary.layerBId,
      tensionWhere: null,
      whyMeaningful: primary.reason,
    };
  } else if (primary?.type === 'insufficient_data' || primary?.type === 'independent') {
    balanceOrTension = {
      type: primary.type,
      labelTr: primary.labelTr,
      layerA: primary.layerAId,
      layerB: primary.layerBId,
      tensionWhere: null,
      whyMeaningful: primary.reason,
    };
  }

  const whyRelated = buildWhy(primary, sessionHints);
  const limits = buildLimits(layers, pairs, safety);
  const reflectionQuestion = buildReflectionQuestion(primary, commonTheme);

  let additionalDataRequest = null;
  if (failed.length) {
    additionalDataRequest = `Kısmi yanıt: başarısız katmanlar (${failed.map((l) => l.layerId).join(', ')}). Eksik kaynak veya geçerli referans eklenebilir.`;
  } else if (primary?.type === 'insufficient_data' || successful.length < 2) {
    additionalDataRequest =
      'Güvenilir ortak örüntü için her katmanda net temalar, zaman kapsamı ve kaynak bilgisi ekleyin.';
  } else if (input?.userAskedToCombine && primary?.type === 'independent') {
    additionalDataRequest =
      'Birleştirme talebi alındı; ancak mevcut temalar bağımsız duruyor. Ortak kavram veya aynı zaman kapsamı netleştirilebilir.';
  }

  // Guard against accidental certainty language in composed narrative fields
  const claimCheck = evaluateSynthesisClaim(
    [commonTheme.text, whyRelated, balanceOrTension?.whyMeaningful].filter(Boolean).join(' '),
  );
  if (!claimCheck.accepted) {
    limits.push('Üretilen taslakta yasaklı kesinlik dili saptandı ve ayıklandı.');
  }

  const sections = {
    sourceSummaries: layers.map(summarizeLayer),
    commonTheme: commonTheme.text,
    balanceOrTension,
    whyRelated: sanitizeCertaintyLanguage(whyRelated).text,
    limits,
    reflectionQuestion,
    additionalDataRequest,
  };

  const confidence =
    primary?.type === 'insufficient_data'
      ? 'insufficient'
      : pairs.some((p) => p.confidenceGap >= 2)
        ? 'low'
        : successful.length >= 3 && (primary?.sharedThemeIds?.length ?? 0) > 0
          ? 'medium'
          : 'medium';

  return {
    version: CROSS_LAYER_SYNTHESIS_VERSION,
    status:
      failed.length && successful.length
        ? 'partial'
        : primary?.type === 'insufficient_data'
          ? 'insufficient_data'
          : 'complete',
    sections,
    relationships: pairs,
    primaryRelationship: primary,
    sourceVisibility: buildSourceVisibility(layers),
    confidence,
    partial: failed.length > 0,
    failedLayers: failed.map((l) => l.layerId),
    safety,
    sessionHints,
    prose: formatSynthesisProse(sections),
  };
}

/**
 * Fixed user-facing order (§5).
 * @param {object} sections
 */
export function formatSynthesisProse(sections) {
  const blocks = [];

  const summaries = Array.isArray(sections.sourceSummaries) ? sections.sourceSummaries : [];
  if (summaries.length) {
    blocks.push(
      summaries
        .map((s) => {
          const text = String(s.summary || '')
            .replace(/\([^)]*astronomy-engine[^)]*\)/gi, '')
            .replace(/\bkaynak=[^;]+;\s*/gi, '')
            .replace(/\byöntem=[^;]+;\s*/gi, '')
            .trim();
          return `${s.layerId}: ${text || '—'}`;
        })
        .join('\n'),
    );
  } else {
    blocks.push('Karşılaştırılacak katman yok.');
  }

  if (sections.commonTheme) {
    blocks.push(`Ortak çizgi: ${sections.commonTheme}`);
  }

  if (sections.balanceOrTension) {
    const b = sections.balanceOrTension;
    const bits = [`İlişki: ${b.labelTr ?? b.type}.`];
    if (b.layerA) bits.push(`Katman A: ${b.layerA}`);
    if (b.layerB) bits.push(`Katman B: ${b.layerB}`);
    if (b.tensionWhere) bits.push(`Gerilim: ${b.tensionWhere}`);
    if (b.whyMeaningful) bits.push(b.whyMeaningful);
    blocks.push(bits.join(' '));
  }

  if (sections.whyRelated) {
    blocks.push(sections.whyRelated);
  }

  const limits = sections.limits ?? [];
  if (limits.length) {
    blocks.push(`Sınır: ${limits.slice(0, 2).join(' ')}`);
  }

  if (sections.reflectionQuestion) {
    blocks.push(sections.reflectionQuestion);
  }

  if (sections.additionalDataRequest) {
    blocks.push(sections.additionalDataRequest);
  }

  blocks.push('Tek katman hüküm vermez; bu bir yakınsama okumasıdır.');

  const joined = blocks.filter(Boolean).join('\n\n');
  return sanitizeCertaintyLanguage(joined).text;
}

/**
 * Example tone helper used in docs/tests — never asserts verification.
 */
export function exampleSafeSynthesisSentence() {
  return (
    'Kur’an katmanı sorumluluk ve sonuç temasını öne çıkarırken, günün astrolojik katmanı acele ile sabır arasındaki gerilimi vurguluyor. ' +
    'Bunlar aynı yönteme ait değildir; fakat ikisi birlikte okunduğunda karar vermeden önce sonuçları tartma yönünde ortak bir düşünme alanı açıyor.'
  );
}
