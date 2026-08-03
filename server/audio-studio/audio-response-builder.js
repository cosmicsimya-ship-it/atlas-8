/**
 * Honest, capability-bound reply builder for Audio Studio.
 * NEVER invents processing capacity. NEVER says "gönder, yaparım" when unsupported.
 */

import {
  summarizeCapabilities,
  CAPABILITY_LABELS,
} from './capability-registry.js';
import { formatAnalysisForUser } from './audio-metadata.js';
import { userMessageForAudioError } from './audio-errors.js';

/**
 * @param {string|null|undefined} displayName
 */
function address(displayName) {
  const n = String(displayName || '').trim();
  return n ? `${n}, ` : '';
}

/**
 * @param {ReturnType<typeof summarizeCapabilities>} summary
 */
function formatCapabilityLists(summary) {
  const enabled = summary.enabled.map((e) => e.label);
  const needs = summary.requiresProvider.map((e) => e.label);
  const disabled = summary.disabled.map((e) => e.label);
  return { enabled, needs, disabled };
}

/**
 * Core truthful reply for production / feature / capability asks.
 * @param {{
 *   displayName?: string|null,
 *   intent: import('./audio-intent.js').AudioIntent,
 *   registry: object,
 *   analysisReport?: object|null,
 *   job?: object|null,
 *   safetyBlock?: { message: string }|null,
 *   errorCode?: string|null,
 *   clarifyingQuestions?: string[],
 * }} ctx
 */
export function buildAudioStudioReply(ctx) {
  if (ctx.safetyBlock?.message) {
    return ctx.safetyBlock.message;
  }
  if (ctx.errorCode) {
    return userMessageForAudioError(ctx.errorCode);
  }

  const intent = ctx.intent;
  const summary = summarizeCapabilities(ctx.registry);
  const lists = formatCapabilityLists(summary);
  const name = address(ctx.displayName);

  const hasProcessing =
    lists.enabled.some((l) =>
      /gürültü|stem|perde|mix|mastering|aranje|enstrüman/i.test(l),
    ) || Boolean(ctx.registry.flags?.processing && lists.enabled.length > 2);

  const analysisOn = Boolean(ctx.registry.metadataInspection?.enabled);
  const uploadOn = Boolean(ctx.registry.audioUpload?.enabled);

  // Capability question
  if (intent?.intent === 'ask_audio_capabilities' || intent?.isCapabilityQuestion) {
    return buildCapabilityAnswer(name, lists, analysisOn, uploadOn);
  }

  // Feature request / future studio production without live processors
  if (
    intent?.isFeatureRequest ||
    intent?.intent === 'save_audio_feature_request' ||
    (intent?.isProductionRequest && !hasProcessing)
  ) {
    return buildUnsupportedProductionReply(name, intent, lists, analysisOn, uploadOn, ctx);
  }

  // Analysis-only path
  if (
    ['analyze_audio', 'evaluate_recording_quality', 'identify_song_structure', 'detect_tempo_key'].includes(
      intent?.intent,
    )
  ) {
    if (!analysisOn) {
      return `${name}Kayıt analizi talebini anladım; ancak teknik analiz modülü şu anda aktif değil (ffprobe/FFmpeg veya analiz bayrağı kapalı).`;
    }
    if (ctx.analysisReport) {
      return `${name}${formatAnalysisForUser(ctx.analysisReport)}`;
    }
    return `${name}Kaydı teknik olarak analiz edip inceleyebilirim. Dosyayı WAV, MP3 veya M4A olarak göndermen yeterli; seviye, süre, kanal yapısı ve olası format sorunlarını çıkarırım. Mix/mastering bu adımın parçası değil.`;
  }

  // Transcription
  if (intent?.intent === 'transcribe_audio') {
    if (ctx.registry.transcription?.enabled) {
      return `${name}Konuşmayı metne çevirebilirim. Ses dosyasını gönder; metni çıkarırım. Bu, stüdyo mix/mastering demek değildir.`;
    }
    return `${name}Transkripsiyon şu anda yapılandırılmamış (API anahtarı veya bayrak kapalı).`;
  }

  // Full support path (only when processing ops truly enabled)
  if (intent?.isProductionRequest && hasProcessing) {
    return buildSupportedProductionReply(name, intent, lists, ctx);
  }

  // Partial: analysis available, processing not
  if (intent?.isProductionRequest && analysisOn) {
    return buildPartialSupportReply(name, intent, lists, ctx);
  }

  return buildUnsupportedProductionReply(name, intent, lists, analysisOn, uploadOn, ctx);
}

function buildCapabilityAnswer(name, lists, analysisOn, uploadOn) {
  const lines = [
    `${name}Ses tarafında runtime kapasitemi abartmadan söyleyeyim:`,
  ];
  if (uploadOn) lines.push(`• Aktif: ${['ses dosyası kabulü', ...(analysisOn ? ['teknik analiz'] : [])].join(', ')}.`);
  if (lists.enabled.length) {
    lines.push(`• Şu an doğrudan kullanılabilir: ${lists.enabled.join(', ')}.`);
  }
  if (lists.needs.length) {
    lines.push(
      `• Entegrasyon / sağlayıcı gerekir (bayrak açık olsa bile motor bağlı değilse çalışmaz): ${lists.needs.join(', ')}.`,
    );
  }
  if (lists.disabled.length) {
    lines.push(`• Kapalı veya henüz yok: ${lists.disabled.slice(0, 8).join(', ')}.`);
  }
  lines.push(
    'Aktif olmayan bir işlemi “yaparım” diye sunmam. Stüdyo mix/mastering için gerekli motor bağlı değilse bunu geliştirme talebi olarak not ederim; bağlıysa dosya sonrası gerçekçi planı söylerim.',
  );
  return lines.join('\n');
}

function describeRequestedOps(intent) {
  const ops = intent?.requestedOperations || [];
  const labels = {
    noise_reduction: 'gürültü temizleme',
    vocal_enhancement: 'vokal iyileştirme',
    instrument_balance: 'enstrüman / vokal dengesi',
    mixing: 'mix',
    mastering: 'mastering',
    add_instrumentation: 'aranje / enstrüman ekleme',
    stem_separation: 'stem ayrımı',
    vocal_tuning: 'perde düzeltme',
    metadata_inspection: 'teknik analiz',
    analyze: 'kalite analizi',
    transcription: 'transkripsiyon',
    format_convert: 'format dönüştürme',
  };
  return ops.map((o) => labels[o] || o);
}

function buildUnsupportedProductionReply(name, intent, lists, analysisOn, uploadOn, ctx) {
  const wanted = describeRequestedOps(intent);
  const instrumentHint = intent?.instrumentsMentioned?.includes('baglama')
    ? 'bağlama ve vokalin birlikte olduğu kaydı'
    : 'gönderdiğin kaydı';

  const head = name
    ? `${name}ne istediğini anladım: ${instrumentHint} temizleyip dengeli bir mix, uygun efektler ve mastering ile stüdyo kaydına yaklaştırmak istiyorsun.`
    : `Ne istediğini anladım: ${instrumentHint} temizleyip dengeli bir mix, uygun efektler ve mastering ile stüdyo kaydına yaklaştırmak istiyorsun.`;

  const body = [
    head,
    'Bu tek bir “ses temizleme” işlemi değil; aranje, mix ve mastering içeren kapsamlı bir ses prodüksiyon talebi.',
    'Şu anda Atlas’ın aktif ses işleme hattında bu işlemi doğrudan üreten bir motor bağlı değil. Bu yüzden yapılabiliyormuş gibi söz veremem.',
  ];

  if (wanted.length) {
    body.push(`İstediğin alt başlıklar: ${wanted.join(', ')}.`);
  }

  if (analysisOn && uploadOn) {
    body.push(
      'Dosyayı yalnızca aktif analiz özelliği varsa teknik açıdan inceleyebilirim (süre, codec, kanal yapısı, bariz format sorunları). Stüdyo versiyonunu üretebilmem için ses işleme entegrasyonunun kurulması gerekir.',
    );
  } else if (uploadOn) {
    body.push('Dosya kabulü açık olabilir; ancak teknik analiz veya işleme motoru şu an aktif değil.');
  }

  if (lists.needs.length) {
    body.push(`Sağlayıcı bekleyen yetenekler: ${lists.needs.join(', ')}.`);
  }

  if (intent?.isFeatureRequest) {
    body.push(
      'Bunu geliştirme / özellik talebi olarak oturum içinde not edebilirim; kalıcı ürün backlog’una yazdığımı iddia etmem — bunun için ayrıca onayın gerekir.',
    );
  }

  if (ctx.clarifyingQuestions?.length) {
    body.push(`İleride motor bağlandığında ilk soracaklarım: ${ctx.clarifyingQuestions.join(' ')}`);
  }

  return body.join(' ');
}

function buildPartialSupportReply(name, intent, lists, ctx) {
  const wanted = describeRequestedOps(intent);
  const head = name
    ? `${name}Kaydı teknik olarak analiz edip süre, kanal yapısı, codec ve olası format sorunlarını belirleyebilirim.`
    : 'Kaydı teknik olarak analiz edip süre, kanal yapısı, codec ve olası format sorunlarını belirleyebilirim.';

  const body = [head];
  const unavailable = [...lists.needs, ...lists.disabled].filter((l) =>
    /gürültü|stem|mix|master|aranje|perde|enstrüman/i.test(l),
  );
  if (unavailable.length) {
    body.push(`Ancak şu anda aktif değil: ${unavailable.join(', ')}.`);
  } else {
    body.push('Ancak enstrüman ekleme ve tam mix/mastering şu anda aktif değil.');
  }
  if (wanted.length) {
    body.push(
      `Talebindeki üretim adımları (${wanted.join(', ')}) için sağlayıcı entegrasyonu gerekir.`,
    );
  }
  if (ctx.analysisReport) {
    body.push(formatAnalysisForUser(ctx.analysisReport));
  } else if (intent?.awaitingFile) {
    body.push('Analiz için dosyayı gönderebilirsin; stüdyo mix vaadi vermiyorum.');
  }
  return body.join(' ');
}

function buildSupportedProductionReply(name, intent, lists, ctx) {
  const enabled = lists.enabled.map((x) => x).join(', ');
  const head = name
    ? `${name}Kaydı gönderebilirsin.`
    : `Kaydı gönderebilirsin.`;
  const body = [
    head,
    'Önce teknik analiz yapacağım; ardından yalnızca aktif olan aşamaları uygulayacağım.',
    `Şu an aktif modüller: ${enabled || 'analiz'}.`,
    'İşleme başlamadan önce hedef tarzı ve varsa referans parçayı soracağım.',
    'Aktif olmayan bir adımı tamamlanmış gibi söylemem.',
  ];
  if (ctx.clarifyingQuestions?.length) {
    body.push(ctx.clarifyingQuestions.slice(0, 3).join(' '));
  }
  return body.join(' ');
}

/**
 * Minimum clarifying questions (1–3) based on intent gaps.
 * @param {import('./audio-intent.js').AudioIntent} intent
 * @param {{ hasFile?: boolean }} opts
 */
export function selectClarifyingQuestions(intent, opts = {}) {
  const q = [];
  if (!opts.hasFile && intent?.awaitingFile) {
    q.push('Kaydı (tercihen WAV/MP3/M4A) göndermen gerekir.');
  }
  if (intent?.intent === 'create_studio_version' || intent?.intent === 'add_instruments') {
    if (!intent.instrumentsMentioned?.length) {
      q.push('Kayıtta vokal ve enstrüman aynı anda mı?');
    }
    q.push('Hedef tarz veya referans bir parça var mı?');
    if (intent.requestedOperations?.includes('add_instrumentation')) {
      q.push('Yeni enstrüman eklenmesini istiyor musun?');
    }
  }
  return q.slice(0, 3);
}

/**
 * Guard: strip accidental false promises from any reply (defense in depth).
 * Does not rewrite quoted refusals.
 * @param {string} reply
 * @param {object} registry
 */
export function enforceTruthfulAudioReply(reply, registry) {
  let text = String(reply || '');
  const processingOn = Boolean(registry?.flags?.processing);
  const hasRealProcessor =
    registry?.noiseReduction?.enabled ||
    registry?.mixing?.enabled ||
    registry?.mastering?.enabled ||
    registry?.stemSeparation?.enabled ||
    registry?.vocalTuning?.enabled ||
    registry?.instrumentGeneration?.enabled;

  if (!processingOn || !hasRealProcessor) {
    // Protect quoted segments
    const quotes = [];
    text = text.replace(/[“"][^”"]*[”"]/g, (m) => {
      quotes.push(m);
      return `__Q${quotes.length - 1}__`;
    });
    text = text
      .replace(
        /gönder\s*,?\s*(?:ben\s+)?(?:düzenlerim|yaparım)/gi,
        'dosyayı teknik olarak inceleyebilirim; stüdyo üretimi şu an aktif değil',
      )
      .replace(
        /\b(?:düzenlerim|yaparım|mastering\s+yapacağım|mix(?:ing)?\s+yapacağım)\b/gi,
        'şu an bu üretim adımını çalıştıramam',
      );
    text = text.replace(/__Q(\d+)__/g, (_, i) => quotes[Number(i)] || '');
  }
  return text;
}

export { CAPABILITY_LABELS };
