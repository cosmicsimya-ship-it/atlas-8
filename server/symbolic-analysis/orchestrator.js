/**
 * Symbolic Analysis Orchestrator
 *
 * 1. resolve available layers
 * 2. check consents
 * 3. run layers independently
 * 4. normalize
 * 5. find shared themes
 * 6. detect tensions
 * 7. preserve uncertainty
 * 8. compose unified result
 * 9. final safety filter
 */

import {
  SYMBOLIC_ANALYSIS_VERSION,
  SYMBOLIC_LAYER_IDS,
  makeUserSection,
} from './schema.js';
import {
  resolveCapabilities,
  resolveConsents,
  INPUT_CONTRACT,
  LAYER_REQUIREMENTS,
  PHOTO_CAPABILITY,
  LAYER_READINESS,
} from './capability.js';
import { runSymbolicLayer } from './layers/run.js';
import { composeUserResult } from './compose.js';
import {
  isSymbolicMetadataV2Enabled,
  isClassicalAbjadShadowEnabled,
  CLASSICAL_ABJAD_METHODOLOGY,
} from './methodology-ids.js';
import { buildLatinMotifMethodologyBundle } from './methodology-metadata.js';
import {
  runClassicalAbjad,
  buildClassicalShadowSummary,
} from './layers/classical-abjad-runner.js';
import { ARABIC_ABJAD } from './data/ebced-table.js';

const CLASSICAL_SHADOW_ERROR_CODE = 'CLASSICAL_SHADOW_UNAVAILABLE';

/**
 * Optional test-only hooks for shadow fail-isolation regressions.
 * Production code paths leave this null.
 * @type {{
 *   runClassicalAbjad?: typeof runClassicalAbjad,
 *   buildClassicalShadowSummary?: typeof buildClassicalShadowSummary,
 * } | null}
 */
let classicalShadowTestHooks = null;

/**
 * @param {{
 *   runClassicalAbjad?: typeof runClassicalAbjad,
 *   buildClassicalShadowSummary?: typeof buildClassicalShadowSummary,
 * } | null} hooks
 */
export function __setClassicalAbjadShadowTestHooks(hooks) {
  classicalShadowTestHooks = hooks && typeof hooks === 'object' ? hooks : null;
}

/**
 * Additive, PII-safe shadow error envelope (no names / spellings / stacks).
 * @param {string} [errorCode]
 */
function buildClassicalShadowErrorEnvelope(errorCode = CLASSICAL_SHADOW_ERROR_CODE) {
  return {
    mode: 'shadow',
    userResultUnchanged: true,
    compare: {
      status: 'error',
      complete: false,
      methodologyId: CLASSICAL_ABJAD_METHODOLOGY.methodologyId,
      methodologyVersion: CLASSICAL_ABJAD_METHODOLOGY.methodologyVersion,
      rulesetVersion: CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion,
      errorCode,
      total: null,
      combinedTotal: null,
      letterCount: 0,
      digitReductionApplied: false,
      hadAlifMadda: false,
      hadStandaloneHamza: false,
      productionAlifMaddaValue: null,
      alifMaddaDivergence: false,
    },
  };
}

/**
 * Best-effort PII-safe shadow log — never throws to caller.
 * @param {object} payload
 */
function logClassicalShadowSafe(payload) {
  try {
    console.info('[ATLAS classical-shadow]', JSON.stringify(payload));
  } catch {
    // Logging failures must not affect analysis.
  }
}

/**
 * Detect whether a string is predominantly Arabic script (for shadow candidate).
 * @param {string} text
 */
function looksLikeArabicSpelling(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  let arabic = 0;
  let other = 0;
  for (const ch of s) {
    if (/\s/u.test(ch)) continue;
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(ch)) arabic += 1;
    else other += 1;
  }
  return arabic > 0 && arabic >= other;
}

/**
 * Build privacy-safe classical shadow compare (additive metadata only).
 * Never mutates Latin userResult. Exceptions are swallowed → error envelope.
 * @param {ReturnType<typeof normalizeInput>} input
 */
function buildClassicalShadowMetadata(input) {
  if (!isClassicalAbjadShadowEnabled()) return null;

  try {
    const extras = input.extras && typeof input.extras === 'object' ? input.extras : {};
    const selectedSpelling =
      (typeof extras.selectedSpelling === 'string' && extras.selectedSpelling.trim()) ||
      (typeof input.selectedSpelling === 'string' && input.selectedSpelling.trim()) ||
      null;
    const spellingConfirmed =
      extras.spellingConfirmed === true || input.spellingConfirmed === true;
    const includeMotherName =
      extras.includeMotherName === true || input.includeMotherName === true;
    const motherSpelling =
      (typeof extras.motherNameSelectedSpelling === 'string' &&
        extras.motherNameSelectedSpelling.trim()) ||
      (typeof input.motherNameSelectedSpelling === 'string' &&
        input.motherNameSelectedSpelling.trim()) ||
      null;
    const motherConfirmed =
      extras.motherSpellingConfirmed === true || input.motherSpellingConfirmed === true;

    /** Prefer explicit selectedSpelling; else Arabic fullName/name for arabic-only shadow. */
    let spelling = selectedSpelling;
    let confirmed = spellingConfirmed;
    if (!spelling) {
      const candidate = String(input.fullName || input.name || '').trim();
      if (looksLikeArabicSpelling(candidate)) {
        spelling = candidate;
        // Shadow may compute when Arabic text is present; confirmation still required
        // for complete status — without confirm, runner returns pending_confirmation.
        confirmed = spellingConfirmed;
      }
    }

    const classicalInput = {
      selectedSpelling: spelling,
      spellingConfirmed: confirmed,
      includeMotherName,
      motherNameSelectedSpelling: motherSpelling,
      motherSpellingConfirmed: motherConfirmed,
      forceConfirmationRequired: extras.forceConfirmationRequired === true,
    };

    const runFn =
      typeof classicalShadowTestHooks?.runClassicalAbjad === 'function'
        ? classicalShadowTestHooks.runClassicalAbjad
        : runClassicalAbjad;
    const summarizeFn =
      typeof classicalShadowTestHooks?.buildClassicalShadowSummary === 'function'
        ? classicalShadowTestHooks.buildClassicalShadowSummary
        : buildClassicalShadowSummary;

    const result = runFn(classicalInput);
    const productionAlifMaddaValue = ARABIC_ABJAD['آ'] ?? null;
    const summary = summarizeFn(result, { productionAlifMaddaValue });

    logClassicalShadowSafe({
      rulesetVersion: summary.rulesetVersion,
      status: summary.status,
      total: summary.total,
      letterCount: summary.letterCount,
      hadAlifMadda: summary.hadAlifMadda,
      alifMaddaDivergence: summary.alifMaddaDivergence,
      errorCode: summary.errorCode,
    });

    return {
      mode: 'shadow',
      userResultUnchanged: true,
      compare: summary,
    };
  } catch {
    logClassicalShadowSafe({
      rulesetVersion: CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion,
      status: 'error',
      errorCode: CLASSICAL_SHADOW_ERROR_CODE,
    });
    return buildClassicalShadowErrorEnvelope(CLASSICAL_SHADOW_ERROR_CODE);
  }
}

/**
 * @param {import('./capability.js').SymbolicInput} input
 */
function normalizeInput(input = {}) {
  const trim = (v) => (typeof v === 'string' ? v.trim() : v);
  return {
    name: trim(input.name) || '',
    birthDate: trim(input.birthDate) || '',
    birthTime: trim(input.birthTime) || null,
    birthPlace: trim(input.birthPlace) || null,
    intention: trim(input.intention) || null,
    fullName: trim(input.fullName) || null,
    motherName: trim(input.motherName) || null,
    // Classical path fields (additive; unused when flag off)
    selectedSpelling: trim(input.selectedSpelling) || null,
    spellingConfirmed: input.spellingConfirmed === true,
    motherNameSelectedSpelling: trim(input.motherNameSelectedSpelling) || null,
    motherSpellingConfirmed: input.motherSpellingConfirmed === true,
    includeMotherName: input.includeMotherName === true,
    // Never accept photo while infrastructure is absent
    photoRef: PHOTO_CAPABILITY.uploadEnabled ? trim(input.photoRef) || null : null,
    consents: input.consents && typeof input.consents === 'object' ? input.consents : {},
    extras: input.extras && typeof input.extras === 'object' ? input.extras : {},
  };
}

/**
 * @param {import('./normalize.js').NormalizedSymbolicLayer[]} normalized
 */
function synthesizePatterns(normalized) {
  const success = normalized.filter((l) => l.status === 'success');
  const themeCount = new Map();
  for (const layer of success) {
    for (const theme of layer.themes || []) {
      const key = String(theme).toLocaleLowerCase('tr-TR');
      themeCount.set(key, (themeCount.get(key) || 0) + 1);
    }
  }

  const convergences = [];
  for (const [theme, count] of themeCount.entries()) {
    if (count >= 2) {
      convergences.push(
        `“${theme}” motifi birden fazla katmanda tekrar ediyor; sembolik bir örtüşme olarak okunabilir.`,
      );
    }
  }

  const tensions = [];
  const themeSets = success.map((l) => new Set((l.themes || []).map((t) => t.toLocaleLowerCase('tr-TR'))));
  if (themeSets.length >= 2) {
    const softOpposites = [
      ['hareket', 'içe dönüş'],
      ['acele', 'sabır'],
      ['güç', 'yumuşaklık'],
    ];
    for (const [a, b] of softOpposites) {
      const hasA = themeSets.some((s) => [...s].some((t) => t.includes(a)));
      const hasB = themeSets.some((s) => [...s].some((t) => t.includes(b)));
      if (hasA && hasB) {
        tensions.push(
          `“${a}” ve “${b}” motifleri birlikte duruyor; gerilim bir çelişki hükmü değil, düşünülecek bir denge noktasıdır.`,
        );
      }
    }
  }

  const uncertainty = [];
  if (success.length < 2) {
    uncertainty.push(
      'Tek veya az katman çıktığı için ortak örüntü belirsizliği korunmuştur.',
    );
  }
  if (!convergences.length && success.length >= 2) {
    uncertainty.push(
      'Katmanlar yan yana duruyor; zorunlu bir ortak tema dayatılmadı.',
    );
  }

  return { convergences, tensions, uncertainty };
}

function emptyTrace(capabilities) {
  return {
    layerOrder: [],
    layers: {},
    capabilities,
    patterns: { convergences: [], tensions: [], uncertainty: [] },
    findings: { computed: [], interpreted: [] },
    normalized: [],
  };
}

/**
 * @param {{ input?: import('./capability.js').SymbolicInput, layers?: string[] }} [options]
 */
export function buildSymbolicAnalysis(options = {}) {
  const input = normalizeInput(options.input || {});
  const capabilities = resolveCapabilities(input);
  const consent = resolveConsents(input);

  if (!capabilities.ok) {
    return {
      version: SYMBOLIC_ANALYSIS_VERSION,
      ok: false,
      error: 'MISSING_REQUIRED_INPUT',
      missingRequired: capabilities.missingRequired,
      userResult: {
        title: 'Sembolik Analiz',
        status: 'insufficient_data',
        sections: [
          makeUserSection(
            'summary',
            `Devam etmek için şu alanlar gerekli: ${capabilities.missingRequired.join(', ')}.`,
          ),
          makeUserSection('method', 'Eksik alanlar tamamlanmadan analiz başlatılmaz. Veri uydurulmaz.'),
        ],
        methodDisclosure: [],
      },
      trace: emptyTrace(capabilities),
      metadata: {
        llmUsed: false,
        fabricated: false,
        inputContract: INPUT_CONTRACT,
        photoUpload: false,
        consents: consent.consents,
      },
    };
  }

  if (!consent.ok) {
    return {
      version: SYMBOLIC_ANALYSIS_VERSION,
      ok: false,
      error: 'CONSENT_REQUIRED',
      missingRequired: consent.missing,
      userResult: {
        title: 'Sembolik Analiz',
        status: 'insufficient_data',
        sections: [
          makeUserSection(
            'summary',
            'Analize devam etmek için açık onaylar gereklidir. Onay olmadan kişisel veriler işlenmez.',
          ),
          makeUserSection(
            'method',
            'Sembolik okuma niteliği ve veri işleme onayları işaretlenmeden sonuç üretilmez.',
          ),
        ],
        methodDisclosure: [],
      },
      trace: emptyTrace(capabilities),
      metadata: {
        llmUsed: false,
        fabricated: false,
        inputContract: INPUT_CONTRACT,
        photoUpload: false,
        consents: consent.consents,
      },
    };
  }

  const requested =
    Array.isArray(options.layers) && options.layers.length > 0
      ? options.layers.filter((id) => SYMBOLIC_LAYER_IDS.includes(id))
      : [...SYMBOLIC_LAYER_IDS];

  // Run order: ebced first so esma can optionally use reduced digit / themes
  const ordered = [...requested].sort((a, b) => {
    if (a === 'ebced') return -1;
    if (b === 'ebced') return 1;
    return 0;
  });

  /** @type {object[]} */
  const layerOutcomes = [];
  /** @type {import('./normalize.js').NormalizedSymbolicLayer[]} */
  const normalizedList = [];

  let ebcedContext = { reducedDigit: null, themes: [] };

  for (const id of ordered) {
    const cap = capabilities.layers[id] || {
      eligible: false,
      missing: ['unknown'],
      readiness: LAYER_READINESS[id] ?? 'planned',
      runnable: false,
    };

    let outcome;
    try {
      outcome = runSymbolicLayer(id, cap, input, ebcedContext);
    } catch (err) {
      outcome = {
        id,
        title: LAYER_REQUIREMENTS[id]?.label ?? id,
        status: 'error',
        eligible: cap.eligible,
        skipReason: null,
        computed: null,
        interpreted: null,
        normalized: {
          layerId: id,
          source: id,
          method: 'orchestrator-catch',
          calculatedData: null,
          interpretation: null,
          themes: [],
          cautions: [],
          confidence: 'none',
          limitations: ['Katman hatası'],
          status: 'error',
          skipReason: null,
          warnings: [err?.message ?? 'LAYER_EXCEPTION'],
        },
        warnings: [err?.message ?? 'LAYER_EXCEPTION'],
        metadata: { version: SYMBOLIC_ANALYSIS_VERSION },
      };
    }

    layerOutcomes.push(outcome);
    if (outcome.normalized) normalizedList.push(outcome.normalized);

    if (id === 'ebced' && outcome.status === 'success' && outcome.normalized) {
      ebcedContext = {
        reducedDigit: outcome.normalized.calculatedData?.reducedDigit ?? null,
        themes: outcome.normalized.themes || [],
      };
    }
  }

  const patterns = synthesizePatterns(normalizedList);
  const composed = composeUserResult({
    layers: normalizedList,
    patterns,
    input,
    unavailableNote:
      'Bu analiz, şu anda kullanılabilir veri katmanları üzerinden hazırlanmıştır.',
  });

  /** @type {Record<string, object>} */
  const layersById = {};
  for (const outcome of layerOutcomes) layersById[outcome.id] = outcome;

  const findings = {
    computed: normalizedList
      .filter((l) => l.calculatedData)
      .map((l) => ({ layerId: l.layerId, data: l.calculatedData })),
    interpreted: normalizedList
      .filter((l) => l.interpretation)
      .map((l) => ({ layerId: l.layerId, data: { interpretation: l.interpretation, themes: l.themes } })),
  };

  /** @type {Record<string, unknown>} */
  const metadata = {
    llmUsed: false,
    fabricated: false,
    inputContract: INPUT_CONTRACT,
    photoUpload: PHOTO_CAPABILITY.uploadEnabled,
    consents: consent.consents,
    eligibleCount: Object.values(capabilities.layers).filter((l) => l.eligible).length,
    availableCount: Object.values(capabilities.layers).filter((l) => l.runnable).length,
    plannedCount: layerOutcomes.filter(
      (l) => l.status === 'planned' || l.status === 'unavailable',
    ).length,
    skippedCount: layerOutcomes.filter((l) => l.status === 'skipped').length,
    successCount: layerOutcomes.filter((l) => l.status === 'success').length,
    errorCount: layerOutcomes.filter((l) => l.status === 'error').length,
  };

  /** @type {Record<string, unknown>} */
  const userResult = {
    title: composed.title,
    status: composed.status,
    sections: composed.sections,
    methodDisclosure: composed.methodDisclosure,
  };

  if (composed.methodologyPresentation) {
    userResult.methodologyPresentation = composed.methodologyPresentation;
  }

  if (isSymbolicMetadataV2Enabled()) {
    const ebcedNorm = normalizedList.find(
      (l) => l.layerId === 'ebced' && l.status === 'success' && l.calculatedData,
    );
    if (ebcedNorm) {
      const bundle = buildLatinMotifMethodologyBundle({
        input,
        calculatedData: ebcedNorm.calculatedData,
        locale: 'tr',
      });
      metadata.symbolicMethodology = {
        methodologyId: bundle.methodologyId,
        methodologyVersion: bundle.methodologyVersion,
        rulesetVersion: bundle.rulesetVersion,
        catalogVersion: bundle.catalogVersion,
        generatedAt: bundle.generatedAt,
      };
      metadata.assessment = bundle.assessment;
      metadata.inputSnapshot = bundle.inputSnapshot;
      metadata.reproducibilitySnapshot = bundle.reproducibilitySnapshot;
      if (bundle.notes?.length) {
        metadata.methodologyNotes = bundle.notes;
      }
      // LEGACY_CONFIDENCE_STILL_PRESENT on layer.normalized.confidence — not copied to metadata.assessment
    }
    metadata.symbolicMetadataV2 = true;
  }

  // Faz 3: classical shadow compare — additive only; never alters userResult / Latin totals.
  // Outer try/catch: shadow isolation must not break primary analysis even if helper regresses.
  let classicalShadow = null;
  try {
    classicalShadow = buildClassicalShadowMetadata(input);
  } catch {
    if (isClassicalAbjadShadowEnabled()) {
      classicalShadow = buildClassicalShadowErrorEnvelope(CLASSICAL_SHADOW_ERROR_CODE);
      logClassicalShadowSafe({
        rulesetVersion: CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion,
        status: 'error',
        errorCode: CLASSICAL_SHADOW_ERROR_CODE,
      });
    }
  }
  if (classicalShadow) {
    metadata.classicalAbjadShadow = classicalShadow;
  }

  return {
    version: SYMBOLIC_ANALYSIS_VERSION,
    ok: true,
    error: null,
    missingRequired: [],
    userResult,
    trace: {
      layerOrder: ordered,
      layers: layersById,
      capabilities,
      patterns,
      findings,
      normalized: normalizedList,
    },
    metadata,
  };
}
