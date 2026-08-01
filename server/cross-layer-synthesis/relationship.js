/**
 * Pairwise relationship classification between normalized layers.
 * Does not force agreement; prefers insufficient_data when evidence is thin.
 */

import { RELATIONSHIP_TYPES, RELATIONSHIP_LABELS_TR } from './schema.js';
import {
  extractThemeIds,
  normalizeThemePhrases,
  intersectStrings,
} from './theme-lexicon.js';

const BALANCE_PAIRS = [
  ['patience', 'haste'],
  ['action', 'withdrawal'],
  ['action', 'reflection'],
  ['haste', 'reflection'],
];

const TENSION_HINTS = [
  ['action', 'withdrawal'],
  ['haste', 'patience'],
  ['action', 'patience'],
];

/**
 * @param {import('./schema.js').NormalizedLayer} layer
 * @returns {{ ids: string[], phrases: string[], usable: boolean }}
 */
function layerThemeBundle(layer) {
  const phrases = normalizeThemePhrases(layer.themes ?? []);
  const fromText = extractThemeIds([
    ...phrases,
    layer.interpretation,
    ...(layer.tensions ?? []),
  ]);
  const ids = [...new Set([...fromText, ...extractThemeIds(phrases)])];
  const usable =
    layer.status === 'success' || layer.status === 'partial'
      ? ids.length > 0 || phrases.length > 0
      : false;
  return { ids, phrases, usable };
}

function hasBalancePair(idsA, idsB) {
  for (const [x, y] of BALANCE_PAIRS) {
    if ((idsA.includes(x) && idsB.includes(y)) || (idsA.includes(y) && idsB.includes(x))) {
      return { x, y };
    }
  }
  return null;
}

function hasTensionPair(idsA, idsB) {
  for (const [x, y] of TENSION_HINTS) {
    if ((idsA.includes(x) && idsB.includes(y)) || (idsA.includes(y) && idsB.includes(x))) {
      return { x, y };
    }
  }
  return null;
}

function temporalCompatible(a, b) {
  if (!a.temporalScope || !b.temporalScope) return { comparable: false, same: false };
  const same = String(a.temporalScope) === String(b.temporalScope);
  return { comparable: true, same };
}

function confidenceGap(a, b) {
  const rank = { high: 3, medium: 2, low: 1, insufficient: 0 };
  const ra = rank[a.confidence] ?? 1;
  const rb = rank[b.confidence] ?? 1;
  return Math.abs(ra - rb);
}

/**
 * Quran vs symbolic: never classify as "supporting" in a verification sense.
 * Overlap becomes same_theme_different_angle or complementing at most.
 * @param {string} typeA
 * @param {string} typeB
 * @param {string} proposed
 */
function softenQuranSymbolic(typeA, typeB, proposed) {
  const types = new Set([typeA, typeB]);
  const hasQuran = types.has('quran');
  const hasSymbolic = ['astrology', 'numerology', 'astronomical', 'symbolic', 'traditional'].some(
    (t) => types.has(t),
  );
  if (!hasQuran || !hasSymbolic) return proposed;
  if (proposed === 'supporting') return 'same_theme_different_angle';
  if (proposed === 'contradictory') return 'tension';
  return proposed;
}

/**
 * @param {import('./schema.js').NormalizedLayer} layerA
 * @param {import('./schema.js').NormalizedLayer} layerB
 * @returns {object}
 */
export function classifyPairRelationship(layerA, layerB) {
  const a = layerThemeBundle(layerA);
  const b = layerThemeBundle(layerB);

  const baseMeta = {
    layerAId: layerA.layerId,
    layerBId: layerB.layerId,
    labelTr: null,
    sharedThemeIds: [],
    sharedPhrases: [],
    distinctThemeIdsA: [],
    distinctThemeIdsB: [],
    temporal: temporalCompatible(layerA, layerB),
    confidenceGap: confidenceGap(layerA, layerB),
    comparable: true,
    reason: '',
    evidence: [],
  };

  if (layerA.status === 'error' || layerB.status === 'error' || layerA.status === 'unavailable' || layerB.status === 'unavailable') {
    return {
      ...baseMeta,
      type: 'insufficient_data',
      labelTr: RELATIONSHIP_LABELS_TR.insufficient_data,
      comparable: false,
      reason: 'Bu iki katman arasında güvenilir bir ortak örüntü kurmak için yeterli veri yok.',
      evidence: [`status:${layerA.layerId}=${layerA.status}`, `status:${layerB.layerId}=${layerB.status}`],
    };
  }

  if (!a.usable || !b.usable) {
    return {
      ...baseMeta,
      type: 'insufficient_data',
      labelTr: RELATIONSHIP_LABELS_TR.insufficient_data,
      comparable: false,
      reason: 'Bu iki katman arasında güvenilir bir ortak örüntü kurmak için yeterli veri yok.',
      evidence: ['one_or_both_layers_lack_themes'],
    };
  }

  const sharedIds = intersectStrings(a.ids, b.ids);
  const sharedPhrases = intersectStrings(a.phrases, b.phrases);
  const distinctA = a.ids.filter((id) => !sharedIds.includes(id));
  const distinctB = b.ids.filter((id) => !sharedIds.includes(id));

  baseMeta.sharedThemeIds = sharedIds;
  baseMeta.sharedPhrases = sharedPhrases;
  baseMeta.distinctThemeIdsA = distinctA;
  baseMeta.distinctThemeIdsB = distinctB;

  const balance = hasBalancePair(a.ids, b.ids);
  const tension = hasTensionPair(a.ids, b.ids);

  /** @type {string} */
  let type = 'independent';
  let reason = 'Ortak tema kimliği bulunamadı; katmanlar ayrı duruyor.';
  const evidence = [];

  if (sharedIds.length >= 1 || sharedPhrases.length >= 1) {
    if (distinctA.length === 0 && distinctB.length === 0) {
      type = 'supporting';
      reason = 'Her iki katman da aynı tema kümesine işaret ediyor (yöntemler ayrı kalır).';
    } else if (balance) {
      type = 'balancing';
      reason = `Katmanlar ${balance.x} / ${balance.y} ekseninde birbirini dengeleyen vurgular taşıyor.`;
    } else if (distinctA.length > 0 && distinctB.length > 0 && sharedIds.length > 0) {
      type = 'same_theme_different_angle';
      reason = 'Ortak tema var; her katman farklı bir açı ekliyor.';
    } else {
      type = 'complementing';
      reason = 'Ortak zemin var; bir katman diğerinin kapsamadığı yönü tamamlıyor.';
    }
    evidence.push(...sharedIds.map((id) => `shared_theme:${id}`));
    evidence.push(...sharedPhrases.map((p) => `shared_phrase:${p}`));
  } else if (balance) {
    type = 'balancing';
    reason = `Doğrudan ortak tema yok; ${balance.x} ile ${balance.y} arasında dengeleyici ilişki okunabilir.`;
    evidence.push(`balance_pair:${balance.x}|${balance.y}`);
  } else if (tension) {
    type = 'tension';
    reason = `Katmanlar ${tension.x} / ${tension.y} geriliminde ayrışıyor; bu hata değil, düşünülecek bir fark.`;
    evidence.push(`tension_pair:${tension.x}|${tension.y}`);
  } else if (
    (layerA.tensions?.length && b.ids.length) ||
    (layerB.tensions?.length && a.ids.length)
  ) {
    type = 'tension';
    reason = 'Bir katmanın gerilim alanı diğerinin temasıyla kesişiyor.';
    evidence.push('explicit_tension_field');
  } else {
    type = 'independent';
    reason = 'Karşılaştırılabilir ortak örüntü kurulamadı; katmanlar birbirinden bağımsız duruyor.';
    evidence.push('no_shared_themes');
  }

  // Strong opposite claims without shared ground → contradictory
  if (
    type === 'tension' &&
    distinctA.length > 0 &&
    distinctB.length > 0 &&
    sharedIds.length === 0 &&
    layerA.confidence === 'high' &&
    layerB.confidence === 'high'
  ) {
    type = 'contradictory';
    reason =
      'Katmanlar yüksek güvenle zıt yönlere işaret ediyor; çelişki gizlenmez, ayrı konumlar korunur.';
  }

  type = softenQuranSymbolic(layerA.layerType, layerB.layerType, type);

  if (!RELATIONSHIP_TYPES.includes(type)) {
    type = 'independent';
  }

  if (baseMeta.confidenceGap >= 2) {
    evidence.push('confidence_levels_differ');
    reason += ' Kaynakların kesinlik düzeyleri eşit değildir.';
  }

  if (baseMeta.temporal.comparable && !baseMeta.temporal.same) {
    evidence.push('temporal_scope_mismatch');
    reason += ' Zaman kapsamları birebir örtüşmüyor.';
  }

  return {
    ...baseMeta,
    type,
    labelTr: RELATIONSHIP_LABELS_TR[type],
    reason,
    evidence,
  };
}

/**
 * @param {import('./schema.js').NormalizedLayer[]} layers
 * @returns {object[]}
 */
export function classifyAllPairs(layers) {
  const pairs = [];
  for (let i = 0; i < layers.length; i += 1) {
    for (let j = i + 1; j < layers.length; j += 1) {
      pairs.push(classifyPairRelationship(layers[i], layers[j]));
    }
  }
  return pairs;
}
