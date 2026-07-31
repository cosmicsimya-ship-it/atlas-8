/**
 * Compose unified user-facing result from normalized layers + patterns.
 * Technical layer ids stay out of default body copy.
 *
 * Faz 1–2: when ATLAS_SYMBOLIC_METADATA_V2 is on, methodDisclosure uses
 * human methodology labels; methodologyPresentation is always visible.
 */

import { makeUserSection, USER_SECTION_IDS } from './schema.js';
import { filterUserSections } from './safety.js';
import {
  ATLAS_LATIN_MOTIF_METHODOLOGY,
  CLASSICAL_ABJAD_COMING_SOON,
  isSymbolicMetadataV2Enabled,
} from './methodology-ids.js';

/** Human labels for technical calculatedData keys (UI-facing). */
const DATA_KEY_LABELS = Object.freeze({
  reducedDigit: 'Sembolik motif sayısı',
  totalSum: 'Harf-sayı toplamı',
  letterCount: 'Sayılan harf adedi',
  reductionSteps: 'İndirgeme adımları',
  nameUsed: 'Kullanılan isim',
  usedMotherName: 'Anne adı dahil mi',
  parts: 'İsim parçaları',
  matchMode: 'Esma seçim yolu',
  seedThemes: 'Kullanılan temalar',
  catalogSize: 'Katalog kapsamı',
  selected: 'Önerilen isimler',
  intentionProvided: 'Niyet belirtildi mi',
});

function friendlyDataKeys(keys) {
  return (Array.isArray(keys) ? keys : []).map((k) => DATA_KEY_LABELS[k] || k);
}

function friendlyMatchMode(mode) {
  if (mode === 'theme-overlap') return 'Tema benzerliği';
  if (mode === 'stable-name-offset') {
    return 'Atlas deneysel kararlı motif seçimi';
  }
  return mode || null;
}

/**
 * @param {{
 *   layers: import('./normalize.js').NormalizedSymbolicLayer[],
 *   patterns: { convergences: string[], tensions: string[], uncertainty: string[] },
 *   input: object,
 *   unavailableNote: string|null,
 * }} ctx
 */
export function composeUserResult(ctx) {
  const v2Meta = isSymbolicMetadataV2Enabled();
  const success = ctx.layers.filter((l) => l.status === 'success');
  const failed = ctx.layers.filter((l) => l.status === 'error');
  const skipped = ctx.layers.filter((l) => l.status === 'skipped');
  const planned = ctx.layers.filter(
    (l) => l.status === 'planned' || l.status === 'unavailable',
  );

  const ebced = success.find((l) => l.layerId === 'ebced');
  const esma = success.find((l) => l.layerId === 'esma');
  const allThemes = [...new Set(success.flatMap((l) => l.themes))];
  const allCautions = [...new Set(success.flatMap((l) => l.cautions))];

  /** @type {Record<string, string>} */
  const bodies = {};

  if (success.length === 0) {
    bodies.summary =
      'Girdi alındı; ancak şu anda sonuç üretebilen bir veri katmanı çalıştırılamadı. Eksik onay, eksik veri veya katman hatası nedeniyle kişiselleştirilmiş okuma üretilmedi.';
  } else {
    const motifBits = [];
    if (ebced?.calculatedData?.reducedDigit != null) {
      motifBits.push(
        v2Meta
          ? `Atlas Latin motif sayısı ${ebced.calculatedData.reducedDigit}`
          : `sayısal motif ${ebced.calculatedData.reducedDigit}`,
      );
    }
    if (esma?.calculatedData?.selected?.length) {
      const names = esma.calculatedData.selected.map((n) => n.latin).join(', ');
      motifBits.push(`destekleyici isimler (${names})`);
    }
    bodies.summary = [
      'Bu analiz, şu anda kullanılabilir veri katmanları üzerinden hazırlanmıştır.',
      motifBits.length ? `Eldeki verilerle öne çıkan işaretler: ${motifBits.join('; ')}.` : '',
      'Sonuçlar sembolik bir düşünme alanıdır; kesin hüküm değildir.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (allThemes.length) {
    bodies.pattern = `Ana örüntü, eldeki katmanlarda tekrar eden şu motifler etrafında toplanıyor: ${allThemes
      .slice(0, 6)
      .join(', ')}. Bu, tek bir katmanın dayattığı bir kader değildir.`;
  } else if (success.length) {
    bodies.pattern =
      'Katmanlar çalıştı; ortak tema henüz zayıf. Belirsizlik bilinçli olarak korunuyor.';
  }

  if (ctx.patterns.convergences.length) {
    bodies.balance = `İç denge açısından örtüşen noktalar: ${ctx.patterns.convergences.join(' ')}`;
  } else if (ebced && esma) {
    bodies.balance =
      'Harf-sayı motifi ile isim yönelimleri yan yana okunabilir; biri diğerini doğrulamaz, birlikte bir denge alanı açabilir.';
  } else if (success.length === 1) {
    bodies.balance =
      'Tek katman çıktığı için denge karşılaştırması sınırlıdır; ek katmanlar hazır oldukça zenginleşecektir.';
  }

  const echoParts = success
    .map((l) => l.interpretation)
    .filter(Boolean)
    .slice(0, 2);
  if (echoParts.length) {
    bodies.echoes = echoParts.join('\n\n');
  }

  if (allThemes.length || ctx.input?.intention) {
    const intent = ctx.input?.intention
      ? `Niyetiniz (“${String(ctx.input.intention).trim()}”) bu okumaya bağlandı.`
      : 'Niyet belirtilmedi; okuma temel girdiler üzerinden kuruldu.';
    bodies.meaning = `${intent} Anlam katmanı sembolik bir çerçevedir; ilahi hüküm veya tıbbi yönlendirme değildir.`;
  }

  if (esma?.calculatedData?.selected?.length) {
    bodies.names = esma.calculatedData.selected
      .map(
        (n) =>
          `${n.latin} — ${n.orientation}. Sembolik olarak bir düşünme alanı açabilir; kesin yönlendirme değildir.`,
      )
      .join('\n');
  }

  const tensionBits = [...ctx.patterns.tensions];
  if (failed.length) {
    tensionBits.push(
      'Bazı anlam alanları teknik bir sorun nedeniyle bu sefer üretilemedi; analiz kısmi kaldı.',
    );
  }
  if (skipped.length) {
    tensionBits.push(
      'Bazı alanlar için veri yetersiz olduğu için ilgili bölümler bilinçli olarak atlandı.',
    );
  }
  if (tensionBits.length || allCautions.length) {
    bodies.tensions = [...tensionBits, ...allCautions.slice(0, 3)].join(' ');
  }

  bodies.reflection = ctx.input?.intention
    ? `Bu niyet (“${String(ctx.input.intention).trim()}”) için kendine sorabileceğin soru: Eldeki işaretler içinde hangisi şu an en çok içsel dürüstlük istiyor — ve hangisini abartmamak daha doğru olur?`
    : 'Kendine sorabileceğin soru: Bu okumada hangisi sana tanıdık geliyor, hangisi yalnızca gürültü olabilir? Atlas karar vermez; alanı açar.';

  const footnotes = [
    ctx.unavailableNote ||
      'Bu analiz, şu anda kullanılabilir veri katmanları üzerinden hazırlanmıştır.',
    planned.length
      ? 'Hazır olmayan anlam alanları sahte sonuç üretmez; yol haritasında tutulur.'
      : null,
    ...ctx.patterns.uncertainty,
    success.length
      ? 'Ayrıntılı yöntem notları “Yöntemi gör” altında incelenebilir.'
      : null,
  ].filter(Boolean);

  if (v2Meta && ebced) {
    bodies.method = [
      ATLAS_LATIN_MOTIF_METHODOLOGY.disclaimer,
      ...footnotes,
    ].join(' ');
  } else {
    bodies.method = footnotes.join(' ');
  }

  const methodDisclosure = success.map((l) => {
    const keys =
      l.calculatedData && typeof l.calculatedData === 'object'
        ? Object.keys(l.calculatedData)
        : [];
    /** @type {Record<string, unknown>} */
    const row = {
      source: l.source,
      method: l.method,
      usedDataKeys: keys,
      limitations: l.limitations || [],
    };
    if (v2Meta) {
      if (l.layerId === 'ebced') {
        row.displayName = ATLAS_LATIN_MOTIF_METHODOLOGY.displayName;
        row.disclaimer = ATLAS_LATIN_MOTIF_METHODOLOGY.disclaimer;
        row.isClassicalAbjad = false;
        row.methodologyId = ATLAS_LATIN_MOTIF_METHODOLOGY.methodologyId;
        row.usedDataLabels = friendlyDataKeys(keys);
      } else if (l.layerId === 'esma') {
        const mode = l.calculatedData?.matchMode;
        row.displayName = 'Destekleyici isim önerileri';
        row.selectionPathLabel = friendlyMatchMode(mode);
        row.usedDataLabels = friendlyDataKeys(keys);
        if (mode === 'stable-name-offset') {
          row.experimental = true;
          row.disclaimer =
            'Atlas Experimental Stable Motif Selection — klasik ebced eşlemesi değildir; yalnızca deneysel kararlı seçimdir.';
        }
      }
    }
    return row;
  });

  const sections = USER_SECTION_IDS.map((id) => {
    const body = bodies[id] || '';
    if (!body && id !== 'summary') return null;
    return makeUserSection(id, body || bodies.summary || '');
  }).filter(Boolean);

  const safeSections = filterUserSections(sections);

  let status = 'partial';
  if (success.length === 0) status = 'insufficient_data';
  else if (failed.length > 0) status = 'partial';
  else if (success.length >= 2) status = 'complete';
  else status = 'partial';

  /** @type {Record<string, unknown>} */
  const result = {
    title: 'Sembolik Analiz',
    status,
    sections: safeSections,
    methodDisclosure,
    availableLayerCount: success.length,
    skippedCount: skipped.length,
    plannedCount: planned.length,
    failedCount: failed.length,
  };

  if (v2Meta && ebced) {
    result.methodologyPresentation = {
      displayName: ATLAS_LATIN_MOTIF_METHODOLOGY.displayName,
      disclaimer: ATLAS_LATIN_MOTIF_METHODOLOGY.disclaimer,
      isClassicalAbjad: false,
      methodologyId: ATLAS_LATIN_MOTIF_METHODOLOGY.methodologyId,
      comingSoon: [CLASSICAL_ABJAD_COMING_SOON],
    };
  }

  return result;
}
