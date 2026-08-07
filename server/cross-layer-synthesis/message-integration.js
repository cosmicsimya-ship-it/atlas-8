/**
 * Message-service bridge for cross-layer synthesis.
 * Collects layers, runs deterministic synthesis once, builds LLM context, guards reply.
 * Does not rewrite the synthesis engine.
 */

import { buildQuranLayer, parseVerseRef, validateVerseReference } from './quran-safety.js';
import { fromSymbolicFinding, fromDailyLayerResult, ensureNormalizedLayer } from './normalize.js';
import {
  analyzeUserSynthesisExample,
  recordUserSynthesisExample,
} from './user-example.js';
import {
  scanCertaintyLanguage,
  sanitizeCertaintyLanguage,
  evaluateSynthesisClaim,
} from './certainty-filter.js';
import { RELATIONSHIP_LABELS_TR, CROSS_LAYER_SYNTHESIS_VERSION } from './schema.js';
import { extractThemeIds } from './theme-lexicon.js';
import { composeSynthesis } from './composer.js';
import {
  buildReflexPromptLock,
  buildReflexStateFromSynthesis,
} from '../cognitive-reflex-guards.js';
import { detectDailyAnalysisIntent, tryDailyAnalysis } from '../daily-analysis-flow.js';
import { buildSymbolicCalendarContext } from '../atlas-symbolic-calendar.js';
import { buildEphemerisSnapshot } from '../atlas-ephemeris.js';
import { numerologyDayNumber } from '../atlas-numerology.js';

export const MESSAGE_SYNTHESIS_BRIDGE_VERSION = 'atlas-message-synthesis-bridge-v1';

const LAYER_CUES = {
  quran: /(kur[’'`]?an|kuran|\bâyet\b|\bayet\b|\bsûre\b|\bsure\b)/i,
  astrology: /(astroloj|bur[cç]\b|gökyüz|gokyuz|transit|\bgezegen|harita|sinastri|natal)/i,
  numerology: /(numerol|sayısal|sayisal|yaşam yolu|yasam yolu|\bebced\b)/i,
  daily: /(g[uü]nl[uü]k analiz|katmanl[ıi]\s+g[uü]nl[uü]k|daily analysis|gezegen saat)/i,
  personal: /(ki[sş]isel analiz|personal analysis|tam analiz)/i,
  tarot: /(\btarot\b|kart a[cç]ılım|açılım iste|acilim iste)/i,
  dream: /(\br[uü]ya\b|\bdream\b|rüyam|ruyam)/i,
};

const COMBINE_INTENT =
  /\b(birleştir|birlestir|sentezle|sentez|ortak tema|zıtlık|zitlik|birbirini destek|birlikte yorumla|birlikte oku|karşılaştır|karsilastir|çok katman|cok katman|meta sentez|arasındaki ilişki|arasindaki iliski|yakınsama|yakinasma|convergence|kesişim|kesisim|denklem)\b/i;

const USER_EXAMPLE_CUE =
  /(örne[gğ]in\s+şöyle|ornegin\s+soyle|ben\s+şöyle\s+sentez|ben\s+soyle\s+sentez|şöyle\s+okurum|soyle\s+okurum|kendi\s+sentezim|şu\s+şekilde\s+birleştir|su\s+sekilde\s+birlestir|şöyle\s+sentezlerim|soyle\s+sentezlerim)/i;

/** Classic digit motifs — symbolic only, never presented as computed truth. */
const DAY_NUMBER_THEME_HINTS = {
  1: ['hareket', 'girişim'],
  2: ['denge', 'işbirliği'],
  3: ['ifade', 'hareket'],
  4: ['sorumluluk', 'düzen'],
  5: ['değişim', 'hareket'],
  6: ['sorumluluk', 'şefkat'],
  7: ['düşünme', 'içe dönüş'],
  8: ['sorumluluk', 'sonuç'],
  9: ['tamamlanma', 'dönüşüm'],
  11: ['sezgi', 'gerilim'],
  22: ['sorumluluk', 'yapı'],
  33: ['şefkat', 'sorumluluk'],
};

/**
 * @param {string} message
 * @returns {{
 *   wantsSynthesis: boolean,
 *   combineExplicit: boolean,
 *   layersRequested: string[],
 *   isUserExample: boolean,
 * }}
 */
export function detectCrossLayerSynthesisIntent(message) {
  const text = String(message ?? '');
  const lower = text.toLocaleLowerCase('tr-TR');
  const layersRequested = [];
  for (const [id, re] of Object.entries(LAYER_CUES)) {
    if (re.test(text) || re.test(lower)) layersRequested.push(id);
  }

  const combineExplicit = COMBINE_INTENT.test(text) || COMBINE_INTENT.test(lower);
  const multiLayerCue = layersRequested.length >= 2;
  const isUserExample = USER_EXAMPLE_CUE.test(text) || USER_EXAMPLE_CUE.test(lower);

  return {
    wantsSynthesis: combineExplicit || multiLayerCue || isUserExample,
    combineExplicit,
    layersRequested,
    isUserExample,
  };
}

/**
 * Find verse-like refs in free text.
 * @param {string} message
 * @returns {string[]}
 */
export function extractVerseReferences(message) {
  const text = String(message ?? '');
  const refs = [];
  const re = /(\d{1,3})\s*[:/]\s*(\d{1,3})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    refs.push(`${m[1]}:${m[2]}`);
  }
  return [...new Set(refs)];
}

function messageThemes(message) {
  return extractThemeIds(message).map((id) => {
    const map = {
      responsibility: 'sorumluluk',
      patience: 'sabır',
      haste: 'acele',
      action: 'hareket',
      withdrawal: 'içe dönüş',
      balance: 'denge',
      reflection: 'düşünme',
      decision: 'karar',
      transformation: 'dönüşüm',
      tension: 'gerilim',
      care: 'şefkat',
      warning: 'dikkat',
    };
    return map[id] ?? id;
  });
}

/**
 * Collect normalized layers for synthesis. Never invents Quran text.
 * @param {{
 *   message: string,
 *   history?: Array<{role:string,content:string}>,
 *   userId?: string|null,
 *   astrologyContext?: object|null,
 *   verseStore?: object|null,
 *   when?: Date,
 *   intentInfo?: ReturnType<typeof detectCrossLayerSynthesisIntent>,
 * }} opts
 */
export function collectSynthesisLayers(opts) {
  const message = opts.message ?? '';
  const intentInfo = opts.intentInfo ?? detectCrossLayerSynthesisIntent(message);
  const themes = messageThemes(message);
  const layers = [];
  const collectionNotes = [];
  const failed = [];

  const wantQuran =
    intentInfo.layersRequested.includes('quran') || extractVerseReferences(message).length > 0;
  const wantAstro =
    intentInfo.layersRequested.includes('astrology') || Boolean(opts.astrologyContext);
  const wantNum =
    intentInfo.layersRequested.includes('numerology') ||
    (intentInfo.layersRequested.includes('daily') && /numerol|sayı/i.test(message)) ||
    (/numerol/i.test(message) && intentInfo.wantsSynthesis);
  const wantDaily = intentInfo.layersRequested.includes('daily') || Boolean(detectDailyAnalysisIntent(message));

  // ── Quran ──
  if (wantQuran) {
    const refs = extractVerseReferences(message);
    if (refs.length === 0) {
      layers.push(
        fromSymbolicFinding({
          layerId: 'quran',
          layerType: 'quran',
          source: 'quran-reference-missing',
          method: 'reference-validation',
          themes: themes.filter((t) => ['sorumluluk', 'sabır', 'sonuç', 'dikkat'].includes(t)),
          status: 'partial',
          confidence: 'low',
          cautions: ['Mesajda doğrulanabilir sûre:âyet referansı bulunamadı.'],
          limitations: ['Kur’an metni üretilmedi; referans eksik.'],
          interpretation: null,
          visibility: { computed: [], interpreted: [], symbolic: ['referans bekleniyor'] },
        }),
      );
      collectionNotes.push('quran:missing_reference');
    } else {
      for (const ref of refs.slice(0, 3)) {
        const built = buildQuranLayer(
          {
            reference: ref,
            selectionMethod: 'user-cited-reference',
            themes: themes.length ? themes : ['sorumluluk'],
            temporalScope: null,
            userContext: message.slice(0, 240),
          },
          opts.verseStore ?? null,
        );
        if (!built.layer) {
          failed.push({ layerId: 'quran', reason: built.errors.join(',') });
          layers.push(
            fromSymbolicFinding({
              layerId: 'quran',
              layerType: 'quran',
              source: 'quran-safety-gate',
              method: 'reference-validation',
              themes: [],
              status: 'error',
              confidence: 'insufficient',
              cautions: [`Geçersiz referans: ${ref} (${built.errors.join(', ')})`],
              limitations: ['Yanlış sûre/âyet; metin üretilmedi.'],
              visibility: {
                computed: [`invalid_ref=${ref}`],
                interpreted: [],
                symbolic: [],
              },
            }),
          );
        } else {
          if (!opts.verseStore) {
            built.layer.cautions = [
              ...(built.layer.cautions ?? []),
              'Doğrulanmış Kur’an store bağlı değil; Arapça/meal metni üretilmedi, yalnızca referans doğrulandı.',
            ];
            built.layer.limitations = [
              ...(built.layer.limitations ?? []),
              'Gerçek meal/Arapça için store gerekir; sahte metin yok.',
            ];
            if (!built.layer.normalizedFacts?.translation && !built.layer.normalizedFacts?.arabic) {
              built.layer.status =
                built.layer.status === 'error' ? 'error' : 'partial';
            }
          }
          if (built.rejectedFabrication) {
            failed.push({ layerId: 'quran', reason: 'fabrication_rejected' });
          }
          layers.push(built.layer);
        }
      }
    }
  }

  // ── Astrology (computed sky + symbolic themes from user message) ──
  if (wantAstro && intentInfo.wantsSynthesis) {
    try {
      const sky =
        opts.astrologyContext?.sky ??
        buildEphemerisSnapshot({
          when: opts.when ?? new Date(),
        });
      const astroThemes =
        themes.length > 0
          ? themes
          : ['düşünme', ...( /acele|sabır/i.test(message) ? ['acele', 'sabır'] : ['karar'])];
      layers.push(
        fromSymbolicFinding({
          layerId: 'astrology',
          layerType: 'astrology',
          source: sky?.metadata?.source ?? opts.astrologyContext?.metadata?.ephemerisSource ?? 'astronomy-engine',
          method: 'ephemeris-symbolic-reading',
          themes: astroThemes,
          tensions: /acele|sabır/i.test(message) ? ['acele ile sabır'] : [],
          normalizedFacts: {
            location: opts.astrologyContext?.locationName ?? null,
            moon: sky?.moon ?? null,
            sun: sky?.sun ?? null,
          },
          interpretation:
            'Gökyüzü verisi hesaplanmıştır; tema okuması semboliktir ve Kur’an’ı doğrulamaz.',
          confidence: 'medium',
          temporalScope: opts.astrologyContext?.calendar?.gregorian?.isoDate ?? null,
          status: sky?.ok ? 'success' : 'partial',
          cautions: ['Astroloji sembolik bir dil; kesin kader veya dini hüküm değildir.'],
          limitations: ['Natal/transit motoru sınırlı; varsayılan konum kullanılabilir.'],
          visibility: {
            computed: ['ephemeris snapshot'],
            interpreted: ['symbolic theme overlay from user context'],
            symbolic: ['astrology reading frame'],
          },
        }),
      );
    } catch (err) {
      failed.push({ layerId: 'astrology', reason: err?.message ?? 'astrology_failed' });
      layers.push(
        fromSymbolicFinding({
          layerId: 'astrology',
          layerType: 'astrology',
          source: 'astrology-flow',
          method: 'ephemeris-symbolic-reading',
          themes: [],
          status: 'error',
          confidence: 'insufficient',
          cautions: ['Astroloji katmanı bu turda üretilemedi.'],
          limitations: [String(err?.message ?? 'astrology_failed')],
          visibility: { computed: [], interpreted: [], symbolic: [] },
        }),
      );
      collectionNotes.push('astrology:error');
    }
  }

  // ── Numerology ──
  if (wantNum && intentInfo.wantsSynthesis) {
    try {
      const calendar =
        opts.astrologyContext?.calendar ?? buildSymbolicCalendarContext(opts.when ?? new Date());
      if (!calendar?.ok) {
        failed.push({ layerId: 'numerology', reason: 'calendar_unavailable' });
        layers.push(
          fromSymbolicFinding({
            layerId: 'numerology',
            layerType: 'numerology',
            source: 'atlas-numerology',
            method: 'sum-then-reduce',
            themes: [],
            status: 'error',
            confidence: 'insufficient',
            cautions: ['Numeroloji için takvim verisi eksik.'],
            visibility: { computed: [], interpreted: [], symbolic: [] },
          }),
        );
      } else {
        const calc = numerologyDayNumber(
          calendar.gregorian.year,
          calendar.gregorian.month,
          calendar.gregorian.day,
        );
        const n = calc.dayNumber;
        const hintThemes = DAY_NUMBER_THEME_HINTS[n] ?? ['düşünme'];
        const iso =
          calendar.gregorian?.isoDate ??
          `${calendar.gregorian.year}-${String(calendar.gregorian.month).padStart(2, '0')}-${String(calendar.gregorian.day).padStart(2, '0')}`;
        layers.push(
          fromSymbolicFinding({
            layerId: 'numerology',
            layerType: 'numerology',
            source: 'sum-then-reduce',
            method: 'gregorian-day-number',
            themes: [...new Set([...hintThemes, ...themes])],
            normalizedFacts: {
              dayNumber: n,
              gregorian: calendar.gregorian,
              isMasterNumber: calc.isMasterNumber,
            },
            interpretation: `Gün sayısı ${n} sembolik motif olarak okunur; bilimsel kanıt veya dini doğrulama değildir.`,
            confidence: 'medium',
            temporalScope: iso,
            status: 'success',
            cautions: ['Numeroloji sembolik eşlemedir.'],
            limitations: ['Klasik digit motifleri yorumdur; hesaplanan tek gerçek dayNumber’dır.'],
            visibility: {
              computed: [`dayNumber=${n}`],
              interpreted: ['digit motif overlay'],
              symbolic: ['numerology symbolism'],
            },
          }),
        );
      }
    } catch (err) {
      failed.push({ layerId: 'numerology', reason: err?.message ?? 'numerology_failed' });
      collectionNotes.push('numerology:error');
    }
  }

  // ── Daily analysis subset (optional enrichment) ──
  if (wantDaily && intentInfo.wantsSynthesis) {
    try {
      const daily = tryDailyAnalysis({ message, date: opts.when });
      if (daily?.report?.layers) {
        const pick = daily.report.layers
          .filter((l) => ['moon-phase', 'gregorian-numerology', 'weekday'].includes(l.id))
          .slice(0, 2);
        for (const layer of pick) {
          layers.push(
            fromDailyLayerResult(layer, {
              themes: themes.length ? themes : ['düşünme'],
              interpretation: null,
              method: 'daily-analysis-adapter',
              limitations: ['Daily-analysis computation only; narrative interpretation null.'],
            }),
          );
        }
        collectionNotes.push('daily-analysis:adapted');
      }
    } catch (err) {
      failed.push({ layerId: 'daily-analysis', reason: err?.message ?? 'daily_failed' });
      collectionNotes.push('daily-analysis:error');
    }
  }

  // Deduplicate by layerId (keep first successful-ish)
  const byId = new Map();
  for (const layer of layers) {
    const prev = byId.get(layer.layerId);
    if (!prev) {
      byId.set(layer.layerId, layer);
      continue;
    }
    const rank = (s) => (s === 'success' ? 3 : s === 'partial' ? 2 : s === 'error' ? 0 : 1);
    if (rank(layer.status) > rank(prev.status)) byId.set(layer.layerId, layer);
  }

  return {
    layers: [...byId.values()],
    failed,
    collectionNotes,
    intentInfo,
  };
}

/**
 * Build controlled LLM context — model must not override locked fields.
 * @param {object} synthesisResult
 */
export function buildSynthesisPromptBlock(synthesisResult, opts = {}) {
  if (!synthesisResult) return '';

  const primary = synthesisResult.primaryRelationship;
  const locked = {
    relationshipType: primary?.type ?? 'insufficient_data',
    relationshipLabelTr: primary?.labelTr ?? RELATIONSHIP_LABELS_TR.insufficient_data,
    confidence: synthesisResult.confidence,
    commonTheme: synthesisResult.sections?.commonTheme ?? null,
    limits: synthesisResult.sections?.limits ?? [],
    sourceVisibility: synthesisResult.sourceVisibility ?? [],
    failedLayers: synthesisResult.failedLayers ?? [],
    status: synthesisResult.status,
  };

  const reflexLock = synthesisResult.reflex
    ? `\n${buildReflexPromptLock(synthesisResult.reflex, { stance: opts.stance ?? null })}\n`
    : '';

  return `
## DETERMINISTIC CROSS-LAYER SYNTHESIS (${CROSS_LAYER_SYNTHESIS_VERSION} / ${MESSAGE_SYNTHESIS_BRIDGE_VERSION})
Bu blok kilitlidir. Bozma, çelişme, yükseltme veya yeni kaynak ekleme.

### KİLİTLİ ALANLAR (değiştirilemez)
- relationshipType: ${locked.relationshipType}
- relationshipLabelTr: ${locked.relationshipLabelTr}
- confidence: ${locked.confidence}
- status: ${locked.status}
- failedLayers: ${JSON.stringify(locked.failedLayers)}
${reflexLock}
### Ortak tema (kilitli)
${locked.commonTheme ?? 'Ortak tema kurulamadı.'}

### İlişki gerekçesi (kilitli)
${synthesisResult.sections?.whyRelated ?? '—'}

### Denge / gerilim (kilitli)
${JSON.stringify(synthesisResult.sections?.balanceOrTension ?? null, null, 2)}

### Kaynak görünürlüğü (kilitli)
${JSON.stringify(locked.sourceVisibility, null, 2)}

### Sınırlar ve güvenlik (silinemez)
${(locked.limits ?? []).map((l) => `- ${l}`).join('\n')}

### Önerilen yapı (koru)
1. Katmanların ayrı özeti
2. Ortak tema
3. Gerilim veya denge
4. Bu ilişkinin neden kurulduğu
5. Yöntem sınırları
6. Kullanıcıya düşünme sorusu

### LLM’ye izin verilen
- Dili doğal hale getir
- Kullanıcı bağlamına göre açıkla
- Düşünme sorusu ekle veya güçlendir

### LLM’ye YASAK
- Yeni ayet / meal / kaynak uydurmak
- relationshipType değiştirmek
- Kesinlik seviyesini yükseltmek
- Güvenlik uyarılarını kaldırmak
- “doğruluyor / kanıtlıyor / gökyüzü bu ayeti…” dili
- Kur’an ile astrolojiyi eşdeğer otorite sunmak
- Hesaplananı yorum, yorumu veri gibi göstermek

### Deterministik iskelet (referans)
${synthesisResult.prose ?? ''}
`.trim();
}

/**
 * Run synthesis at most once for a message turn.
 * @param {object} opts
 */
export function runMessageCrossLayerSynthesis(opts) {
  const intentInfo = opts.intentInfo ?? detectCrossLayerSynthesisIntent(opts.message ?? '');

  if (opts.userExampleText || intentInfo.isUserExample) {
    const exampleText = opts.userExampleText ?? opts.message;
    const analysis = analyzeUserSynthesisExample(exampleText, {
      layersMentioned: intentInfo.layersRequested,
    });
    recordUserSynthesisExample(opts.sessionId ?? 'anonymous', exampleText, {
      layersMentioned: intentInfo.layersRequested,
      persistApproved: false,
      userConsentForPersistentMemory: false,
    });
    opts._userExampleAnalysis = analysis;
  }

  if (!intentInfo.wantsSynthesis && !(opts.forcedLayers?.length >= 2)) {
    return {
      ran: false,
      skippedReason: 'single_layer_or_no_intent',
      synthesis: null,
      promptBlock: null,
      intentInfo,
      collection: null,
    };
  }

  const collection = collectSynthesisLayers({
    message: opts.message,
    history: opts.history,
    userId: opts.userId,
    astrologyContext: opts.astrologyContext,
    verseStore: opts.verseStore ?? null,
    when: opts.when,
    intentInfo,
  });

  const usable = collection.layers.filter((l) => l.status === 'success' || l.status === 'partial');
  const shouldRun =
    collection.layers.length >= 2 ||
    intentInfo.combineExplicit ||
    (opts.forcedLayers?.length ?? 0) >= 2;

  if (!shouldRun || collection.layers.length < 2) {
    return {
      ran: false,
      skippedReason: 'fewer_than_two_layers',
      synthesis: null,
      promptBlock: null,
      intentInfo,
      collection,
    };
  }

  const synthesis = composeSynthesis({
    layers: collection.layers.map(ensureNormalizedLayer),
    userMessage: opts.message,
    sessionId: opts.sessionId ?? opts.userId ?? 'anonymous',
    userAskedToCombine: intentInfo.combineExplicit,
  });

  const reflex = buildReflexStateFromSynthesis(synthesis, {
    usableLayerCount: usable.length,
    casual: opts.casual === true,
    message: opts.message,
  });
  synthesis.reflex = reflex;

  let promptBlock = buildSynthesisPromptBlock(synthesis, {
    stance: opts.stance ?? null,
  });
  if (opts._userExampleAnalysis) {
    promptBlock += `

### Kullanıcı sentez örneği (kopyalama)
- Örnek aynen kopyalanmayacak
- Tespit edilen ilişki türü: ${opts._userExampleAnalysis.relationshipType}
- Güçlü: ${(opts._userExampleAnalysis.strengths || []).join('; ') || '—'}
- Zayıf: ${(opts._userExampleAnalysis.weaknesses || []).join('; ') || '—'}
- Otomatik katılım yok; Persistent Memory’ye yazılmadı
`;
  }

  return {
    ran: true,
    skippedReason: null,
    synthesis,
    promptBlock,
    intentInfo,
    collection,
    usableCount: usable.length,
    reflex,
    bridgeVersion: MESSAGE_SYNTHESIS_BRIDGE_VERSION,
  };
}

const RELATIONSHIP_TYPE_TOKENS = {
  supporting: [/destekleyen/i, /\bsupporting\b/i],
  complementing: [/tamamlayan/i, /\bcomplementing\b/i],
  balancing: [/dengeleyen/i, /\bbalancing\b/i],
  tension: [/gerilim oluşturan/i, /gerilim/i, /\btension\b/i],
  independent: [/birbirinden bağımsız/i, /\bindependent\b/i],
  insufficient_data: [/yetersiz veri/i, /yeterli veri yok/i],
  contradictory: [/çelişkili/i, /\bcontradictory\b/i],
  same_theme_different_angle: [/farklı açıdan/i, /aynı temaya/i],
};

/**
 * Guard final LLM text against deterministic synthesis locks.
 * @param {string} reply
 * @param {object|null} synthesis
 */
export function guardSynthesisReply(reply, synthesis) {
  const original = typeof reply === 'string' ? reply : '';
  const violations = [];

  const claim = evaluateSynthesisClaim(original);
  if (!claim.accepted) {
    violations.push({ id: 'certainty_or_cross_validation', detail: claim.reason });
  }

  const scan = scanCertaintyLanguage(original);
  if (!scan.ok) {
    violations.push({
      id: 'certainty_language',
      detail: scan.hits.map((h) => h.id).join(','),
    });
  }

  const lockedType = synthesis?.primaryRelationship?.type;
  if (lockedType && lockedType !== 'insufficient_data') {
    // If model explicitly claims a conflicting primary relationship label
    const claimedTypes = [];
    for (const [type, patterns] of Object.entries(RELATIONSHIP_TYPE_TOKENS)) {
      if (patterns.some((re) => re.test(original))) claimedTypes.push(type);
    }
  const strongFlip =
      (claimedTypes.includes('supporting') &&
        (lockedType === 'tension' ||
          lockedType === 'contradictory' ||
          lockedType === 'independent' ||
          lockedType === 'balancing' ||
          lockedType === 'same_theme_different_angle')) ||
      (claimedTypes.includes('contradictory') && lockedType === 'supporting');
    if (strongFlip) {
      violations.push({
        id: 'relationship_type_changed',
        detail: `locked=${lockedType}; claimed=${claimedTypes.join(',')}`,
      });
    }
  }

  // Invented verse body heuristics: Arabic script block without locked citation
  if (/[\u0600-\u06FF]{20,}/.test(original)) {
    const allowedArabic = (synthesis?.sections?.sourceSummaries ?? []).some((s) =>
      /arabic|Arapça/i.test(JSON.stringify(s)),
    );
    const hasStoreText = (synthesis?.sourceVisibility ?? []).some((v) =>
      (v.computed ?? []).some((c) => /Arapça metin/i.test(c)),
    );
    if (!allowedArabic && !hasStoreText) {
      violations.push({ id: 'invented_arabic', detail: 'Arabic text without verified store' });
    }
  }

  if (/bugün için ilahi mesaj|allah bugün sana/i.test(original)) {
    violations.push({ id: 'divine_claim', detail: 'divine message language' });
  }

  let text = original;
  if (violations.length) {
    // Prefer deterministic prose when locks are broken
    if (synthesis?.prose) {
      text = synthesis.prose;
      if (synthesis.sections?.reflectionQuestion) {
        // already in prose
      }
    } else {
      text = sanitizeCertaintyLanguage(original).text;
    }
  } else {
    text = sanitizeCertaintyLanguage(original).text;
  }

  // Ensure limits still visible if model dropped them
  if (synthesis?.sections?.limits?.length && violations.some((v) => v.id !== 'invented_arabic')) {
    const limitAnchor = synthesis.sections.limits[0];
    if (limitAnchor && !text.includes(limitAnchor.slice(0, 24)) && synthesis.prose) {
      // soft append source visibility reminder when falling back already handled
    }
  }

  return {
    reply: text,
    violations,
    usedDeterministicFallback: violations.length > 0 && Boolean(synthesis?.prose),
    guarded: true,
  };
}

/**
 * Validate a raw verse ref string for message-level errors.
 * @param {string} ref
 */
export function validateMessageVerseRef(ref) {
  const parsed = parseVerseRef(ref);
  if (parsed.surah == null) return { ok: false, error: 'unparseable_reference' };
  return validateVerseReference(parsed.surah, parsed.ayah);
}
