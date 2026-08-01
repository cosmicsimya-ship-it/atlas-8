// ═══════════════════════════════════════════════════════════════════════
// Health / visual-symptom safety — channel-neutral triage
// Prevents metaphysical confirmation; prefers natural explanations + care cues.
// ═══════════════════════════════════════════════════════════════════════

export const HEALTH_SAFETY_VERSION = 'health-safety-v1';

/** @typedef {'success'|'insufficient_data'|'safe_redirect'|'user_visible_error'} AtlasResultStatus */

export const RESULT_STATUS = Object.freeze({
  SUCCESS: 'success',
  INSUFFICIENT_DATA: 'insufficient_data',
  SAFE_REDIRECT: 'safe_redirect',
  USER_VISIBLE_ERROR: 'user_visible_error',
});

const VISUAL_SYMPTOM =
  /\b(siyah\s*(karart[ıi]|nokta|noktalar|g[öo]lge|g[öo]lgeler)|karart[ıi]lar|u[cç]u[sş]ma|u[cç]u[sş]malar|floaters?|g[öo]rme(?:de|)\s*(azalma|kayb[ıi]|bulan[ıi]k)|bulan[ıi]k\s*g[öo]rme|perde\s*(hissi|gibi)|[ıi][sş][ıi]k\s*[cç]akma|[ıi][sş][ıi]k\s*[cç]akmalar[ıi]|oval\s*(cisim|[sş]ey|g[öo]lge)|hareket\s*eden\s*(cisim|g[öo]lge|[sş]ey)|g[öo]z\s*a[gğ]r[ıi]|g[öo]rsel\s*(belirti|yan[ıi]lsama))\b/i;

const SPIRITUAL_FRAME =
  /\b(cin|cinler|epifiz|epifiz\s*bezi|[uü][cç][uü]nc[uü]\s*g[öo]z|enerji(?:k)?\s*varl[ıi]k|metafizik|spirit[uü]el\s*uyan[ıi][sş]|uyan[ıi][sş]|enerji\s*g[öo]rme|astral|varl[ıi]k\s*g[öo]rme)\b/i;

const URGENT_EYE =
  /\b(ani(?:den)?\s*(art[ıi][sş]|ba[sş]lad[ıi]|g[öo]rme)|yeni\s*ba[sş]layan|perde|g[öo]rme\s*kayb[ıi]|g[öo]rmede\s*(azalma|kay[ıi]p)|[ıi][sş][ıi]k\s*[cç]akma|bulan[ıi]k\s*g[öo]rme|g[öo]z\s*a[gğ]r[ıi]|travma|darbe\s*sonras[ıi]|birden\s*fazla\s*(nokta|karart[ıi]))\b/i;

const METAPHYSICAL_CONFIRM =
  /(bunlar\s+cin|cin\s+(g[öo]r[uü]yorsun|var)|epifiz\s*bezin\s*(a[cç][ıi]l[ıi]yor|a[cç][ıi]lm[ıi][sş])|[uü][cç][uü]nc[uü]\s*g[öo]z[uü]n\s*(a[cç][ıi]lm[ıi][sş]|a[cç][ıi]l[ıi]yor)|enerjik\s*varl[ıi]klar[ıi]\s*g[öo]r[uü]yorsun|kesin\s+spirit[uü]el\s+bir\s+uyan[ıi][sş]|bu\s+bir\s+uyan[ıi][sş]t[ıi]r|epifiz\s*bezi\s*(a[cç][ıi]lm[ıi][sş]|a[cç][ıi]l[ıi]yor))/gi;

const AFFIRMATIVE_METAPHYSICS =
  /(bunlar\s+cin\.|cinleri?\s+g[öo]r[uü]yorsun|kesinlikle\s+epifiz|metafizik\s+olarak\s+do[gğ]rulanm[ıi][sş]t[ıi]r)/gi;

const DIAGNOSIS_CLAIM =
  /\b(sende\s+\w+\s+hastal[ıi][gğ][ıi]\s+var|te[sş]his(?:im|)\s*:|kesin\s+tan[ıi]|retina\s+y[ıi]rt[ıi][gğ][ıi]\s+var)\b/i;

/**
 * Normalize long / punctuation-light text without arbitrary truncation.
 * @param {string} message
 * @returns {{ normalized: string, blocks: string[], summaryForIntent: string }}
 */
export function normalizeLongMessage(message) {
  const raw = String(message ?? '').replace(/\r\n/g, '\n').trim();
  const normalized = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');

  let blocks = normalized
    .split(/\n{2,}|(?<=[.!?…])\s+/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length <= 1 && normalized.length > 180) {
    blocks = [];
    const soft = normalized.split(/(?<=[,;])\s+|\s+(?=ama|ancak|fakat|çünkü|cunku|insanlar|bazen|bu\s+durum)/i);
    let buf = '';
    for (const part of soft) {
      const next = buf ? `${buf} ${part}` : part;
      if (next.length > 160 && buf) {
        blocks.push(buf.trim());
        buf = part;
      } else {
        buf = next;
      }
    }
    if (buf.trim()) blocks.push(buf.trim());
  }

  if (blocks.length === 0 && normalized) blocks = [normalized];

  const summaryForIntent =
    blocks.length <= 3
      ? blocks.join(' ')
      : `${blocks.slice(0, 2).join(' ')} … ${blocks[blocks.length - 1]}`;

  return { normalized, blocks, summaryForIntent };
}

/**
 * @param {string} message
 * @returns {{
 *   active: boolean,
 *   intent: string|null,
 *   visualSymptom: boolean,
 *   spiritualSeeking: boolean,
 *   urgentSigns: boolean,
 *   category: 'visual_spiritual'|'visual_only'|'spiritual_only'|null,
 * }}
 */
export function detectHealthSafetyIntent(message) {
  const { normalized } = normalizeLongMessage(message);
  if (!normalized) {
    return {
      active: false,
      intent: null,
      visualSymptom: false,
      spiritualSeeking: false,
      urgentSigns: false,
      category: null,
    };
  }

  const visualSymptom = VISUAL_SYMPTOM.test(normalized);
  const spiritualSeeking = SPIRITUAL_FRAME.test(normalized);
  const urgentSigns = URGENT_EYE.test(normalized);
  const active = visualSymptom || (spiritualSeeking && /\b(g[öo]r[uü]yorum|g[öo]rd[uü]m|g[öo]r[uü]n[uü]yor|belirti)\b/i.test(normalized));

  let category = null;
  if (visualSymptom && spiritualSeeking) category = 'visual_spiritual';
  else if (visualSymptom) category = 'visual_only';
  else if (active && spiritualSeeking) category = 'spiritual_only';

  return {
    active: Boolean(active),
    intent: active
      ? category === 'visual_spiritual'
        ? 'health:visual_symptom_spiritual'
        : 'health:visual_symptom'
      : null,
    visualSymptom,
    spiritualSeeking,
    urgentSigns,
    category,
  };
}

/**
 * Deterministic safe reply — not a diagnosis.
 * @param {ReturnType<typeof detectHealthSafetyIntent>} detection
 * @param {{ insufficientData?: boolean }} [opts]
 */
export function buildHealthSafetyReply(detection, opts = {}) {
  const urgentBlock = detection.urgentSigns
    ? 'Bu görüntüler yeni başladıysa, son dönemde arttıysa, ışık çakması, görmede perde-gölge, bulanıklık veya görme kaybı eşlik ediyorsa bir göz hekimine kısa sürede görünmen önemli. '
    : 'Bu görüntüler yeni başladıysa, son dönemde arttıysa, ışık çakması, görmede perde-gölge, bulanıklık veya görme kaybı eşlik ediyorsa bir göz hekimine kısa sürede görünmen önemli. Uzun süredir aynı şekilde devam ediyorsa da rutin bir göz muayenesi uygun olur. ';

  const reply =
    'Anlattığın siyah noktalar veya hareket eden gölgeler farklı nedenlerle oluşabilir. ' +
    'Loş ortamda uzun süre tek noktaya odaklanmak görsel yanılsamaları artırabilir; gözde uçuşmalar veya migren aurası gibi durumlar da benzer görüntüler oluşturabilir. ' +
    'Bunu doğrudan epifiz bezi açılımı ya da metafizik bir durum olarak doğrulamak mümkün değil.\n\n' +
    urgentBlock +
    '\n\n' +
    'Bunun ne zaman başladığını, tek gözde mi iki gözde mi olduğunu ve ışık çakması, bulanıklık veya perde hissi olup olmadığını söylersen durumu daha düzenli değerlendirmenene yardımcı olabilirim. ' +
    'Bu bir tıbbi teşhis değildir.';

  if (opts.insufficientData) {
    return {
      reply,
      resultStatus: RESULT_STATUS.INSUFFICIENT_DATA,
      status: 'insufficient_data',
    };
  }

  return {
    reply,
    resultStatus: RESULT_STATUS.SAFE_REDIRECT,
    status: 'safe_redirect',
  };
}

/**
 * Timeout / engine failure fallback — health-aware when relevant.
 * @param {string} [message]
 */
export function buildUserVisibleFallback(message = '') {
  const detection = detectHealthSafetyIntent(message);
  if (detection.active || detection.visualSymptom) {
    return {
      reply:
        'Mesajını aldım ancak yanıtı tamamlayamadım. Görüşünde ani artan siyah noktalar, ışık çakmaları, perde hissi veya görme kaybı varsa gecikmeden göz hekimine başvur.',
      resultStatus: RESULT_STATUS.USER_VISIBLE_ERROR,
      errorCode: 'TIMEOUT',
    };
  }
  return {
    reply: 'Mesajını aldım ancak şu anda yanıtı tamamlayamadım. Lütfen birkaç saniye sonra tekrar dene.',
    resultStatus: RESULT_STATUS.USER_VISIBLE_ERROR,
    errorCode: 'TIMEOUT',
  };
}

/**
 * Strip or soften forbidden metaphysical / diagnostic confirmations.
 * @param {string} reply
 * @returns {{ reply: string, blockedClaims: string[] }}
 */
export function guardHealthSafetyReply(reply) {
  if (typeof reply !== 'string' || !reply.trim()) {
    return { reply: reply ?? '', blockedClaims: [] };
  }

  const blockedClaims = [];
  let text = reply;

  if (METAPHYSICAL_CONFIRM.test(text) || AFFIRMATIVE_METAPHYSICS.test(text)) {
    blockedClaims.push('metaphysical_confirmation');
    // Reset lastIndex after .test on global regexes
    METAPHYSICAL_CONFIRM.lastIndex = 0;
    AFFIRMATIVE_METAPHYSICS.lastIndex = 0;
    text = text
      .replace(METAPHYSICAL_CONFIRM, 'bunu metafizik bir doğrulama olarak sunmuyorum')
      .replace(AFFIRMATIVE_METAPHYSICS, 'bunu metafizik bir doğrulama olarak sunmuyorum')
      .replace(/epifiz\s*bezin\s*(a[cç][ıi]l[ıi]yor|a[cç][ıi]lm[ıi][sş])/gi, 'epifiz bezi açılımı doğrulanamaz')
      .replace(/bunlar\s+cin/gi, 'bunlar cin diye doğrulanamaz');
  }

  if (DIAGNOSIS_CLAIM.test(text)) {
    blockedClaims.push('diagnosis_claim');
    text = text.replace(DIAGNOSIS_CLAIM, 'tıbbi teşhis koyamam');
  }

  if (blockedClaims.length > 0 && !/tıbbi teşhis değildir|doğrulamak mümkün değil/i.test(text)) {
    text +=
      '\n\nNot: Atlas bu tür deneyimleri cin, epifiz açılımı veya spiritüel uyanış olarak doğrulamaz; tıbbi teşhis de koymaz.';
  }

  return { reply: text, blockedClaims };
}

/**
 * Map pipeline status → required resultStatus contract.
 * @param {{ status?: string, errorCode?: string, intent?: string }} result
 * @returns {AtlasResultStatus}
 */
export function resolveResultStatus(result) {
  if (!result) return RESULT_STATUS.USER_VISIBLE_ERROR;
  if (result.status === 'safe_redirect') return RESULT_STATUS.SAFE_REDIRECT;
  if (result.status === 'insufficient_data') return RESULT_STATUS.INSUFFICIENT_DATA;
  if (result.status === 'error' || result.status === 'reject' || result.errorCode) {
    return RESULT_STATUS.USER_VISIBLE_ERROR;
  }
  if (result.status === 'complete' || result.status === 'success') {
    return RESULT_STATUS.SUCCESS;
  }
  return RESULT_STATUS.USER_VISIBLE_ERROR;
}

/**
 * Prompt directive injected when health path still reaches LLM (e.g. with image).
 */
export function buildHealthSafetyPromptDirective() {
  return [
    'HEALTH SAFETY (mandatory):',
    '- Do not confirm cin, epifiz açılımı, üçüncü göz, energetic beings, or spiritual awakening as facts.',
    '- Prefer natural explanations: eye floaters, low-light illusion, migraine aura, fatigue, focus effects.',
    '- Never diagnose a disease. Do not say "you have X".',
    '- If new/worsening spots, flashes, curtain/shadow, vision loss, blur, eye pain, or post-trauma onset: briefly suggest eye doctor / urgent evaluation without panic.',
    '- Ask at most 3 short follow-ups: onset timing, one vs both eyes, flashes/blur/curtain.',
    '- End clearly that this is not a medical diagnosis.',
  ].join('\n');
}
