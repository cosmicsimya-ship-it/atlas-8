/**
 * Audio intent detection — conversation-aware, not keyword-only.
 */

/**
 * @typedef {
 *   'analyze_audio'|
 *   'transcribe_audio'|
 *   'clean_noise'|
 *   'enhance_speech'|
 *   'improve_vocal'|
 *   'tune_vocal'|
 *   'improve_instrument'|
 *   'mix_vocal_and_instrument'|
 *   'add_instruments'|
 *   'arrange_song'|
 *   'separate_stems'|
 *   'master_track'|
 *   'convert_audio_format'|
 *   'extract_audio_from_video'|
 *   'create_studio_version'|
 *   'evaluate_recording_quality'|
 *   'identify_song_structure'|
 *   'detect_tempo_key'|
 *   'save_audio_feature_request'|
 *   'ask_audio_capabilities'|
 *   'unknown_audio_request'|
 *   null
 * } AudioIntentKind
 */

/**
 * @typedef {{
 *   active: boolean,
 *   intent: AudioIntentKind,
 *   confidence: number,
 *   isFeatureRequest: boolean,
 *   isCapabilityQuestion: boolean,
 *   isProductionRequest: boolean,
 *   requestedOperations: string[],
 *   instrumentsMentioned: string[],
 *   awaitingFile: boolean,
 *   cues: string[],
 * }} AudioIntent
 */

const STUDIO_CUES =
  /st[uü]dyo|profesyonel\s+(?:ekip|kay[ıi]t|hale|gibi)|master(?:ing)?|mix(?:ing)?|aranje|aranjman|mix\s*master|mastering|ses\s+(?:d[uü]zenle|temizle|iyile[sş]tir)|kayd[ıi]\s+(?:d[uü]zenle|temizle)|[sş]ark[ıi]\s+haline|demo\s+(?:d[uü]zenle|geli[sş]tir)/i;

const VOCAL_CUES = /vokal|sesimi|s[oö]yleyece[gğ]im|s[oö]yl[uü]yorum|[sş]ark[ıi]\s+s[oö]yle/i;
const INSTRUMENT_CUES =
  /ba[gğ]lama|gitar|piyano|keman|davul|enstr[uü]man|saz|ud|kanun|ney/i;
const NOISE_CUES = /g[uü]r[uü]lt[uü]|temizle|noise|de-?noise|hum|t[ıi]klama/i;
const STEM_CUES = /stem|ay[ıi]r|izol[ae]|vokal[ıi]\s+[oö]ne|ba[gğ]lamay[ıi]\s+[oö]ne/i;
const TUNE_CUES = /tune|perde|auto-?tune|pitch|vokal[ıi]\s+d[uü]zelt/i;
const FORMAT_CUES = /mp3['’]?\s*[eé]|wav['’]?\s*[eé]|d[oö]n[uü][sş]t[uü]r|format\s+[cç]evir/i;
const VIDEO_AUDIO_CUES = /videodaki\s+ses|videodan\s+ses|sesi\s+[cç][ıi]kar/i;
const ANALYZE_CUES =
  /analiz\s+et|kalite(?:sini)?\s+(?:analiz|de[gğ]erlendir|incele)|teknik\s+analiz|ne\s+kadar\s+kaliteli/i;
const TRANSCRIBE_CUES = /yaz[ıi]ya\s+[cç]evir|transkri|metne\s+[cç]evir|ne\s+s[oö]yl[uü]yor/i;
const CAPABILITY_CUES =
  /ses\s+(?:d[uü]zenleyebil|i[sş]leyebil)|yapabilir\s*misin|ses\s+[oö]zelli|audio\s+(?:studio|edit)|hangi\s+ses/i;
const FEATURE_REQUEST_CUES =
  /(?:[oö]zellik\s+ekle|eklensin|ekleyin|olsa\s+iyi|geli[sş]tirme\s+talebi|atlas['’]?\s*a\s+ses|b[oö]yle\s+bir\s+[oö]zellik|yetenek\s+ekle)/i;
const SEND_AND_DO =
  /(?:yollayaca[gğ][ıi]m|g[oö]nderece[gğ]im|g[oö]nder(?:irim|ece[gğ]im)?).{0,80}(?:d[uü]zenle|st[uü]dyo|profesyonel)|(?:d[uü]zenle|st[uü]dyo|profesyonel).{0,80}(?:yollayaca[gğ][ıi]m|g[oö]nderece[gğ]im)/i;

const AUDIO_DOMAIN =
  /ses\s+dosya|ses\s+kay[ıi]t|audio|mp3|wav|m4a|ogg|voice\s+message|mikrofon|kay[ıi]t\s+g[oö]nder|besteyi?\s+(?:sana\s+)?yolla/i;

const FALSE_PROMISE_BLOCK =
  /\b(yapar[ıi]m|d[uü]zenlerim|g[oö]nder\s*,?\s*d[uü]zenlerim|elimden\s+geleni\s+yapar[ıi]m)\b/i;

const CONTEXT_MARKERS = [
  'stüdyo',
  'studio',
  'mix',
  'mastering',
  'bağlama',
  'baglama',
  'vokal',
  'ses düzenle',
  'audio studio',
  'profesyonel kayıt',
  'noise reduction',
  'stem',
];

/**
 * @param {{ role: string, content: string }[]} [history]
 */
export function hasAudioStudioContext(history = []) {
  const corpus = (history || [])
    .slice(-14)
    .map((t) => String(t.content || '').toLocaleLowerCase('tr-TR'))
    .join('\n');
  if (!corpus) return false;
  return CONTEXT_MARKERS.some((m) => corpus.includes(m));
}

/**
 * @param {string} message
 */
function extractInstruments(message) {
  const text = String(message || '');
  const found = [];
  const map = [
    [/ba[gğ]lama/i, 'baglama'],
    [/gitar/i, 'guitar'],
    [/piyano|piano/i, 'piano'],
    [/keman|violin/i, 'violin'],
    [/davul|drum/i, 'drums'],
    [/\bsaz\b/i, 'saz'],
    [/\bud\b/i, 'oud'],
  ];
  for (const [re, id] of map) {
    if (re.test(text)) found.push(id);
  }
  return found;
}

/**
 * Map intent → requested pipeline operations.
 * @param {AudioIntentKind} intent
 */
export function operationsForIntent(intent) {
  switch (intent) {
    case 'create_studio_version':
      return [
        'noise_reduction',
        'vocal_enhancement',
        'instrument_balance',
        'mixing',
        'mastering',
        'add_instrumentation',
      ];
    case 'clean_noise':
      return ['noise_reduction'];
    case 'enhance_speech':
      return ['noise_reduction', 'vocal_enhancement'];
    case 'improve_vocal':
      return ['noise_reduction', 'vocal_enhancement'];
    case 'tune_vocal':
      return ['vocal_tuning'];
    case 'improve_instrument':
      return ['instrument_balance'];
    case 'mix_vocal_and_instrument':
      return ['instrument_balance', 'mixing'];
    case 'add_instruments':
    case 'arrange_song':
      return ['add_instrumentation', 'mixing', 'mastering'];
    case 'separate_stems':
      return ['stem_separation'];
    case 'master_track':
      return ['mastering'];
    case 'convert_audio_format':
      return ['format_convert'];
    case 'extract_audio_from_video':
      return ['format_convert'];
    case 'analyze_audio':
    case 'evaluate_recording_quality':
    case 'identify_song_structure':
    case 'detect_tempo_key':
      return ['analyze', 'metadata_inspection'];
    case 'transcribe_audio':
      return ['transcription'];
    default:
      return [];
  }
}

/**
 * @param {string} message
 * @param {{ role: string, content: string }[]} [history]
 * @param {{ pendingAudioIntent?: boolean, hasMediaAttachment?: boolean, mediaKind?: string|null, allowContextualFollowup?: boolean }} [opts]
 * @returns {AudioIntent}
 */
export function detectAudioIntent(message, history = [], opts = {}) {
  const text = String(message ?? '').trim();
  const empty = {
    active: false,
    intent: null,
    confidence: 0,
    isFeatureRequest: false,
    isCapabilityQuestion: false,
    isProductionRequest: false,
    requestedOperations: [],
    instrumentsMentioned: [],
    awaitingFile: false,
    cues: [],
  };

  if (!text && !opts.hasMediaAttachment && !opts.pendingAudioIntent) {
    return empty;
  }

  const ctx = hasAudioStudioContext(history) || Boolean(opts.pendingAudioIntent);
  const instruments = extractInstruments(text);
  const cues = [];

  const isFeatureRequest = FEATURE_REQUEST_CUES.test(text) ||
    (SEND_AND_DO.test(text) && (STUDIO_CUES.test(text) || VOCAL_CUES.test(text) || INSTRUMENT_CUES.test(text)));
  const strongProduction =
    !FEATURE_REQUEST_CUES.test(text) &&
    (STUDIO_CUES.test(text) ||
      SEND_AND_DO.test(text) ||
      /enstr[uü]man(?:lar)?\s+ekle|araya\s+.{0,40}ekle|aranje|mix\s*master|mastering/i.test(text));
  const isCapabilityQuestion =
    CAPABILITY_CUES.test(text) &&
    /\?|misin|mısın|musun|müsün/i.test(text) &&
    !strongProduction;

  /** @type {AudioIntentKind} */
  let intent = null;
  let confidence = 0;

  if (FEATURE_REQUEST_CUES.test(text) && !opts.hasMediaAttachment) {
    intent = 'save_audio_feature_request';
    confidence = 0.9;
    cues.push('feature_request');
  } else if (isCapabilityQuestion) {
    intent = 'ask_audio_capabilities';
    confidence = 0.9;
    cues.push('capability_question');
  } else if (isFeatureRequest && !opts.hasMediaAttachment && !strongProduction) {
    intent = 'save_audio_feature_request';
    confidence = 0.85;
    cues.push('feature_request');
  } else if (/enstr[uü]man(?:lar)?\s+ekle|araya\s+.{0,40}ekle|aranje\s+yap/i.test(text)) {
    intent = 'add_instruments';
    confidence = 0.88;
    cues.push('add_instruments');
  } else if (STUDIO_CUES.test(text) || SEND_AND_DO.test(text) || /mix\s*master|mastering\s+yap/i.test(text)) {
    intent = 'create_studio_version';
    confidence = 0.92;
    cues.push('studio');
  } else if (VIDEO_AUDIO_CUES.test(text)) {
    intent = 'extract_audio_from_video';
    confidence = 0.88;
    cues.push('video_audio');
  } else if (FORMAT_CUES.test(text) && AUDIO_DOMAIN.test(text)) {
    intent = 'convert_audio_format';
    confidence = 0.85;
    cues.push('format');
  } else if (STEM_CUES.test(text)) {
    intent = /ay[ıi]r|stem|izol/i.test(text) ? 'separate_stems' : 'mix_vocal_and_instrument';
    confidence = 0.82;
    cues.push('stem_or_balance');
  } else if (TUNE_CUES.test(text)) {
    intent = 'tune_vocal';
    confidence = 0.85;
    cues.push('tune');
  } else if (NOISE_CUES.test(text) && (AUDIO_DOMAIN.test(text) || /\bses(?:i|ini)?\b/i.test(text) || ctx || opts.hasMediaAttachment)) {
    intent = 'clean_noise';
    confidence = 0.8;
    cues.push('noise');
  } else if (ANALYZE_CUES.test(text)) {
    intent = 'evaluate_recording_quality';
    confidence = 0.85;
    cues.push('analyze');
  } else if (TRANSCRIBE_CUES.test(text)) {
    intent = 'transcribe_audio';
    confidence = 0.85;
    cues.push('transcribe');
  } else if (
    (VOCAL_CUES.test(text) && INSTRUMENT_CUES.test(text)) ||
    (INSTRUMENT_CUES.test(text) && /beste|kay[ıi]t|yolla|g[oö]nder/i.test(text))
  ) {
    // "Bağlama çalıp söyleyeceğim / besteyi yollayacağım" — production intent with context
    intent = ctx || STUDIO_CUES.test(text) || /d[uü]zenle|profesyonel|st[uü]dyo/i.test(text)
      ? 'create_studio_version'
      : 'save_audio_feature_request';
    confidence = 0.78;
    cues.push('vocal_instrument_plan');
  } else if (
    ctx &&
    opts.allowContextualFollowup !== false &&
    /^(?:devam\s+et|devam|bunu\s+yap|ayn[ıi]\s+[sş]ekilde|tamam\s+yap)\b/i.test(text)
  ) {
    // Explicit continuation only — never infer studio from unrelated announcements
    intent = 'create_studio_version';
    confidence = 0.75;
    cues.push('contextual_followup');
  } else if (
    ctx &&
    opts.allowContextualFollowup !== false &&
    /d[uü]zenle|temizle|[oö]ne\s+[cç][ıi]kar|st[uü]dyo|mix|master/i.test(text) &&
    (AUDIO_DOMAIN.test(text) || STUDIO_CUES.test(text) || VOCAL_CUES.test(text) || INSTRUMENT_CUES.test(text))
  ) {
    // Vague follow-up must still carry current-turn audio evidence
    intent = 'create_studio_version';
    confidence = 0.72;
    cues.push('contextual_followup');
  } else if (opts.hasMediaAttachment && (AUDIO_DOMAIN.test(text) || STUDIO_CUES.test(text) || NOISE_CUES.test(text) || !text)) {
    if (!text) {
      intent = opts.pendingAudioIntent ? 'create_studio_version' : 'analyze_audio';
      confidence = opts.pendingAudioIntent ? 0.7 : 0.55;
      cues.push('media_only');
    }
  }

  // Multi-turn studio requires current-message operational evidence + scoped history context.
  // History alone must never activate studio on an unrelated announcement.
  if (!intent && ctx && opts.allowContextualFollowup !== false) {
    const histText = (history || []).map((h) => h.content || '').join(' ');
    const currentHasOps =
      STUDIO_CUES.test(text) ||
      SEND_AND_DO.test(text) ||
      /d[uü]zenle|temizle|mix|master|stem|aranje/i.test(text) ||
      AUDIO_DOMAIN.test(text);
    if (
      currentHasOps &&
      (INSTRUMENT_CUES.test(histText) || VOCAL_CUES.test(histText) || INSTRUMENT_CUES.test(text)) &&
      /profesyonel|st[uü]dyo|d[uü]zenle|mix|master/i.test(text)
    ) {
      intent = 'create_studio_version';
      confidence = 0.8;
      cues.push('multi_turn_studio');
    }
  }

  if (!intent) {
    // Soft domain mention without clear ask — still not active unless media
    if (AUDIO_DOMAIN.test(text) && /atlas/i.test(text)) {
      intent = 'ask_audio_capabilities';
      confidence = 0.55;
      cues.push('soft_domain');
    } else {
      return empty;
    }
  }

  const isProductionRequest = [
    'create_studio_version',
    'clean_noise',
    'enhance_speech',
    'improve_vocal',
    'tune_vocal',
    'improve_instrument',
    'mix_vocal_and_instrument',
    'add_instruments',
    'arrange_song',
    'separate_stems',
    'master_track',
    'convert_audio_format',
    'extract_audio_from_video',
  ].includes(intent);

  const awaitingFile =
    isProductionRequest &&
    !opts.hasMediaAttachment &&
    intent !== 'ask_audio_capabilities';

  // Feature-request flavour when user describes a future capability without immediate process demand
  const featureLike =
    intent === 'save_audio_feature_request' ||
    (isProductionRequest &&
      !opts.hasMediaAttachment &&
      /yollayaca[gğ][ıi]m|g[oö]nderece[gğ]im|ekle(?:yin|sin)|[oö]zellik/i.test(text));

  return {
    active: true,
    intent,
    confidence,
    isFeatureRequest: featureLike || intent === 'save_audio_feature_request',
    isCapabilityQuestion: intent === 'ask_audio_capabilities',
    isProductionRequest,
    requestedOperations: operationsForIntent(intent),
    instrumentsMentioned: instruments,
    awaitingFile,
    cues,
  };
}

/**
 * Detect misleading promise phrasing (for tests / response guard).
 * Negated / quoted refusals like `“gönder, düzenlerim” demem` are allowed.
 * @param {string} reply
 */
export function containsFalseCapabilityPromise(reply) {
  const text = String(reply || '');
  // Strip quoted exemplars of bad phrases Atlas is refusing to say
  const stripped = text
    .replace(/[“"][^”"]{0,80}[”"]/g, ' ')
    .replace(/'[^']{0,80}'/g, ' ');

  if (/demem doğru olmaz|demem\.|uydurm|vaat etm/i.test(text) && /düzenlerim|yaparım/i.test(text)) {
    // Explicit refusal of the bad phrase
    return false;
  }
  if (FALSE_PROMISE_BLOCK.test(stripped)) return true;
  if (/\b(?:işledim|mastering\s+tamamlandı|profesyonel\s+hale\s+getirdim)\b/i.test(stripped)) {
    if (/ses|mix|master|stüdyo|kayıt/i.test(stripped)) return true;
  }
  if (/gönder\s*,?\s*(?:ben\s+)?(?:düzenlerim|yaparım)/i.test(stripped)) return true;
  return false;
}

export { FALSE_PROMISE_BLOCK };
