/**
 * Telegram turn-intent grounding — current-message primacy + continuation gates.
 * Isolates operational intents (audio/studio) from announcements and cross-topic bleed.
 */

export const TURN_INTENT_VERSION = 'atlas-telegram-turn-intent-v1';

const CONTINUATION_RE =
  /^(?:devam\s+et|devam|bunu\s+yap|ayn[ıi]\s+[sş]ekilde|tamam\s+yap|evet\s+yap|haz[ıi]r|dosyay[ıi]\s+[sş]imdi\s+g[oö]nderiyorum|g[oö]nderiyorum|yolluyorum)\b/i;

const ANNOUNCEMENT_RE =
  /(?:art[ıi]k\s+(?:web|canl[ıi]|kullan[ıi]labiliyor)|https?:\/\/\S+|cosmicsimya\.com|geri\s+bildirim|duyuru|selam\s+arkada[sş]lar|deneyebilir|payla[sş]abilirsiniz|lansman|yay[ıi]nda)/i;

const OPERATIONAL_AUDIO_RE =
  /(?:st[uü]dyo|mix(?:ing)?|master(?:ing)?|\bstem\b|aranje|aranjman|ses\s+(?:d[uü]zenle|temizle|iyile[sş]tir)|kayd[ıi]\s+(?:d[uü]zenle|temizle)|noise|de-?noise|transkri|yaz[ıi]ya\s+[cç]evir|mp3|wav|m4a|mikrofon|enstr[uü]man|ba[gğ]lama|vokal)/i;

/**
 * Build a scoped history key for Telegram (chat + optional topic).
 * @param {{ chatId?: string|null, messageThreadId?: string|number|null, topicId?: string|number|null }} ids
 */
export function telegramHistoryScopeKey(ids = {}) {
  const chat = String(ids.chatId ?? 'default');
  const topic = ids.messageThreadId ?? ids.topicId;
  if (topic != null && String(topic).trim() !== '') {
    return `${chat}:topic:${String(topic).trim()}`;
  }
  return chat;
}

/**
 * Filter history to the same sender (+ same topic when tagged).
 * Assistant turns are kept only when the preceding user turn matches the sender.
 * @param {{ role: string, content: string, userId?: string|null, messageThreadId?: string|number|null }[]} history
 * @param {{ userId?: string|null, messageThreadId?: string|number|null }} scope
 */
export function filterHistoryForSenderScope(history = [], scope = {}) {
  const userId = scope.userId ? String(scope.userId) : null;
  const topic =
    scope.messageThreadId != null && String(scope.messageThreadId).trim() !== ''
      ? String(scope.messageThreadId)
      : null;

  /** @type {typeof history} */
  const out = [];
  let lastUserMatched = false;

  for (const turn of history || []) {
    if (topic != null && turn.messageThreadId != null && String(turn.messageThreadId) !== topic) {
      continue;
    }
    if (turn.role === 'user') {
      const sameUser = !userId || !turn.userId || String(turn.userId) === userId;
      lastUserMatched = sameUser;
      if (sameUser) out.push(turn);
    } else if (turn.role === 'assistant') {
      if (lastUserMatched) out.push(turn);
    }
  }
  return out;
}

/**
 * @param {string} text
 */
export function isInformationalAnnouncement(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (OPERATIONAL_AUDIO_RE.test(t) && !ANNOUNCEMENT_RE.test(t)) return false;
  // Launch / link / feedback share without an explicit operational ask
  if (ANNOUNCEMENT_RE.test(t) && !CONTINUATION_RE.test(t)) {
    // If it also contains a clear audio production ask, not merely informational
    if (
      /(?:l[uü]tfen|istiyorum|yapabilir\s*misin).{0,40}(?:mix|master|st[uü]dyo|d[uü]zenle)/i.test(t)
    ) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * @param {string} text
 * @param {{ hasReplyTarget?: boolean, replyLooksLikePriorTask?: boolean }} [opts]
 */
export function isExplicitContinuation(text, opts = {}) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (CONTINUATION_RE.test(t)) return true;
  if (opts.hasReplyTarget && opts.replyLooksLikePriorTask && /^(?:bunu|şunu|sunu)\b/i.test(t)) {
    return true;
  }
  if (opts.hasReplyTarget && opts.replyLooksLikePriorTask && CONTINUATION_RE.test(t)) {
    return true;
  }
  return false;
}

/**
 * @param {string} text
 */
export function currentMessageHasAudioEvidence(text) {
  return OPERATIONAL_AUDIO_RE.test(String(text || ''));
}

/**
 * Derive per-turn intent grounding for Telegram (and reusable by audio gate).
 * @param {{
 *   message: string,
 *   channel?: string,
 *   userId?: string|null,
 *   chatId?: string|null,
 *   messageThreadId?: string|number|null,
 *   messageId?: string|number|null,
 *   replyTargetMessageId?: string|number|null,
 *   quotedText?: string|null,
 *   repliedToText?: string|null,
 *   hasAttachment?: boolean,
 *   attachmentType?: string|null,
 *   priorIntent?: string|null,
 *   activePendingAction?: string|null,
 *   history?: { role: string, content: string, userId?: string|null }[],
 * }} input
 */
export function deriveTelegramTurnIntent(input) {
  const currentMessageText = String(input.message || '').trim();
  const hasAttachment = Boolean(input.hasAttachment);
  const attachmentType = input.attachmentType || null;
  const priorIntent = input.priorIntent || null;
  const activePendingAction = input.activePendingAction || null;
  const isAnnouncement = isInformationalAnnouncement(currentMessageText);

  const replyLooksLikePriorTask =
    Boolean(activePendingAction) ||
    /st[uü]dyo|mix|master|ses\s+d[uü]zen/i.test(String(input.repliedToText || ''));

  const continuation = isExplicitContinuation(currentMessageText, {
    hasReplyTarget: Boolean(input.replyTargetMessageId),
    replyLooksLikePriorTask,
  });

  const audioEvidence =
    currentMessageHasAudioEvidence(currentMessageText) ||
    (hasAttachment &&
      (attachmentType === 'audio' ||
        attachmentType === 'audio_document' ||
        attachmentType === 'voice'));

  /** @type {string} */
  let currentIntent = 'general';
  if (isAnnouncement) currentIntent = 'announcement';
  else if (audioEvidence || (continuation && activePendingAction === 'audio_instruction')) {
    currentIntent = 'audio_operational';
  } else if (continuation && priorIntent) {
    currentIntent = String(priorIntent);
  }

  const isContinuation =
    continuation &&
    Boolean(activePendingAction || priorIntent) &&
    !isAnnouncement;

  const historyScopeKey = telegramHistoryScopeKey({
    chatId: input.chatId,
    messageThreadId: input.messageThreadId,
  });

  return {
    version: TURN_INTENT_VERSION,
    currentMessageText,
    currentIntent,
    isContinuation,
    continuationTarget: isContinuation ? activePendingAction || priorIntent : null,
    hasAttachment,
    attachmentType,
    replyTarget: input.replyTargetMessageId ?? null,
    quotedText: input.quotedText ?? null,
    repliedToText: input.repliedToText ?? null,
    priorIntent,
    activePendingAction,
    isAnnouncement,
    audioEvidence,
    historyScopeKey,
    allowAudioStudio:
      !isAnnouncement &&
      (audioEvidence ||
        (isContinuation && activePendingAction === 'audio_instruction') ||
        (hasAttachment && activePendingAction === 'audio_instruction')),
  };
}

/**
 * Dev-only intent trace — never prints message body.
 * @param {ReturnType<typeof deriveTelegramTurnIntent> & {
 *   chatId?: string|null,
 *   topicId?: string|number|null,
 *   senderId?: string|null,
 *   messageId?: string|number|null,
 *   activationReason?: string|null,
 *   pendingActionUsed?: boolean,
 * }} trace
 */
export function logTelegramIntentTrace(trace) {
  const enabled =
    process.env.ATLAS_TELEGRAM_INTENT_TRACE === '1' ||
    process.env.NODE_ENV !== 'production';
  if (!enabled) return;

  console.log(
    `[Atlas/tg-intent]` +
      ` chatId=${trace.chatId ?? 'n/a'}` +
      ` topicId=${trace.topicId ?? 'n/a'}` +
      ` senderId=${trace.senderId ?? 'n/a'}` +
      ` messageId=${trace.messageId ?? 'n/a'}` +
      ` replyTargetMessageId=${trace.replyTarget ?? 'n/a'}` +
      ` currentIntent=${trace.currentIntent}` +
      ` priorIntent=${trace.priorIntent ?? 'n/a'}` +
      ` isContinuation=${Boolean(trace.isContinuation)}` +
      ` pendingActionUsed=${Boolean(trace.pendingActionUsed)}` +
      ` historyScopeKey=${trace.historyScopeKey || 'n/a'}` +
      ` activationReason=${trace.activationReason ?? 'n/a'}` +
      ` allowAudioStudio=${Boolean(trace.allowAudioStudio)}`,
  );
}
