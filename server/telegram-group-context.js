import { foldTr } from './conversation-activation.js';

export const GROUP_CONTEXT_MAX_MESSAGES = 12;
export const GROUP_CONTEXT_MAX_AGE_MS = 5 * 60 * 1000;
export const PROCESSED_UPDATE_LIMIT = 2000;

const ACTIONABLE_REQUEST_RE = /(?:\b(?:yapabilir|yapar|yorumlar|yorumla|anlat|a[cç][ıi]kla|s[oö]yle|bakabilir|yard[ıi]m\s+eder|hesapla|incele|de[gğ]erlendir|tabir\s+et|analiz\s+et)(?:\s+m[ıiuü]s[ıi]n)?\b|\b(?:istiyorum|rica\s+ediyorum|l[uü]tfen)\b)/iu;
const DREAM_NARRATIVE_RE = /\br[uü]ya(?:m|mda|mde|da|de|yı|yi|lar|larım)?\b/iu;
const DREAM_DETAIL_RE = /\b(?:g[oö]rd[uüm]|geldi|vardı|oldu|gidiyordum|ko[sş]uyordum|uçuyordum|uyandım|deniz|su|yılan|bebek|anne|baba|ev|kapı|yol|gece|kan|di[sş])\b/iu;
const SUPPORTED_ANALYSIS_RE = /\b(?:astroloji|do[gğ]um\s+haritası|y[uü]kselen|bur[cç]|tarot|ebced|numeroloji|kahve\s+falı|r[uü]ya\s+tabiri|sinastri)\b/iu;

export function shouldIgnoreTelegramMessage(msg) {
  return !msg?.chat || msg?.from?.is_bot === true;
}

export function telegramGroupScopeKey(msg) {
  if (msg?.chat?.id == null) return null;
  const topic = msg.message_thread_id;
  return topic == null ? String(msg.chat.id) : `${msg.chat.id}:topic:${topic}`;
}

export function telegramSpeakerKey(msg) {
  if (msg?.from?.id != null) return `user:${msg.from.id}`;
  if (msg?.sender_chat?.id != null) return `sender_chat:${msg.sender_chat.id}`;
  return null;
}

export function isWakeWordOnly(text, botUsername = null) {
  const folded = foldTr(text).replace(/[?.!,;:…]+$/g, '').trim();
  if (/^(?:atlas|atlascim|atlasim|hey\s+atlas|alo\s+atlas)$/u.test(folded)) return true;
  const username = foldTr(String(botUsername || '').replace(/^@/, ''));
  return Boolean(username && folded === `@${username}`);
}

export function looksLikeActionableRequest(text) {
  const value = String(text || '').trim();
  if (value.length < 4) return false;
  if (ACTIONABLE_REQUEST_RE.test(value)) return true;
  if (DREAM_NARRATIVE_RE.test(value)) {
    return value.length >= 18 || DREAM_DETAIL_RE.test(value);
  }
  return value.length >= 10 && SUPPORTED_ANALYSIS_RE.test(value);
}

export function createGroupContextEntry(msg, text, options = {}) {
  return {
    messageId: msg?.message_id ?? null,
    userId: telegramSpeakerKey(msg),
    at: options.nowMs ?? (Number(msg?.date) ? Number(msg.date) * 1000 : Date.now()),
    text: String(text || '').trim(),
    fromBot: msg?.from?.is_bot === true,
    wasAddressed: options.wasAddressed === true,
    answered: options.answered === true,
    from: msg?.from ? { ...msg.from } : null,
    senderChat: msg?.sender_chat ? { ...msg.sender_chat } : null,
  };
}

export function trimGroupContext(recent, nowMs = Date.now()) {
  const cutoff = nowMs - GROUP_CONTEXT_MAX_AGE_MS;
  return (recent || []).filter((entry) => entry && entry.at >= cutoff).slice(-GROUP_CONTEXT_MAX_MESSAGES);
}

export function resolveContextualWake(recent, current) {
  if (!isWakeWordOnly(current.text, current.botUsername)) return null;
  const nowMs = current.nowMs ?? Date.now();
  const prior = trimGroupContext(recent, nowMs).at(-1);
  if (!prior || prior.fromBot || prior.wasAddressed || prior.answered) return null;
  if (!looksLikeActionableRequest(prior.text)) return null;
  return { text: prior.text, source: prior };
}

export function inspectContextualWake(recent, current) {
  const wakeOnly = isWakeWordOnly(current.text, current.botUsername);
  if (!wakeOnly) {
    return { wakeOnly, matched: false, reason: 'not_wake', candidate: null };
  }

  const nowMs = current.nowMs ?? Date.now();
  const trimmed = trimGroupContext(recent, nowMs);
  const prior = trimmed.at(-1) ?? null;
  if (!prior) {
    return {
      wakeOnly,
      matched: false,
      reason: (recent || []).length ? 'expired' : 'scope_empty',
      candidate: null,
    };
  }

  const actionable = looksLikeActionableRequest(prior.text);
  const candidate = {
    messageId: prior.messageId ?? null,
    actionable,
    wasAddressed: prior.wasAddressed === true,
    answered: prior.answered === true,
    fromBot: prior.fromBot === true,
  };
  if (prior.fromBot) return { wakeOnly, matched: false, reason: 'rejected_bot', candidate };
  if (prior.wasAddressed) return { wakeOnly, matched: false, reason: 'rejected_addressed', candidate };
  if (prior.answered) return { wakeOnly, matched: false, reason: 'rejected_answered', candidate };
  if (!actionable) return { wakeOnly, matched: false, reason: 'rejected_non_actionable', candidate };
  return { wakeOnly, matched: true, reason: 'matched', candidate };
}

export function markContextEntryAnswered(recent, messageId) {
  if (messageId == null) return recent;
  return (recent || []).map((entry) => entry.messageId === messageId ? { ...entry, answered: true } : entry);
}

export function buildContextualPipelineMessage(msg, contextualWake) {
  if (!contextualWake?.source) return msg;
  return {
    ...msg,
    from: contextualWake.source.from ?? undefined,
    sender_chat: contextualWake.source.senderChat ?? undefined,
  };
}

export function createProcessedUpdateTracker(limit = PROCESSED_UPDATE_LIMIT) {
  const processed = new Set();
  return {
    shouldProcess(msg) {
      if (msg?.chat?.id == null || msg?.message_id == null) return true;
      const key = `${msg.chat.id}:${msg.message_id}`;
      if (processed.has(key)) return false;
      processed.add(key);
      if (processed.size > limit) processed.delete(processed.values().next().value);
      return true;
    },
    get size() { return processed.size; },
  };
}
