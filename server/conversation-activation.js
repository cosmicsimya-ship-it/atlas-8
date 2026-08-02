// ═══════════════════════════════════════════════════════════════════════
// Conversation Activation & Session Gate
//
// Default = NO_RESPONSE (especially Telegram groups).
// Atlas replies only when addressed, replied-to, commanded, or an active
// per-user session already exists. DMs / web start a session on first msg.
// ═══════════════════════════════════════════════════════════════════════

export const CONVERSATION_ACTIVATION_VERSION = 'conversation-activation-v1';

/** Idle close — no inbound from this user in the conversation. */
export const SESSION_IDLE_MS = Number(process.env.ATLAS_SESSION_IDLE_MS || 12 * 60 * 1000);

export const BOT_COMMANDS = [
  '/tarot',
  '/ebced',
  '/astro',
  '/analiz',
  '/help',
  '/start',
  '/burc',
  '/numeroloji',
];

/**
 * @typedef {{
 *   conversationId: string,
 *   userId: string,
 *   startedAt: string,
 *   lastActiveAt: string,
 *   intent: string|null,
 *   topic: string|null,
 *   activationReason: string|null,
 * }} ActivationSession
 */

/** @type {Map<string, ActivationSession>} */
const sessions = new Map();

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function sessionKey(conversationId, userId) {
  return `${String(conversationId || 'default')}::${String(userId || 'anon')}`;
}

/**
 * @param {string} text
 */
export function foldTr(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[î]/g, 'i')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/['’]/g, '');
}

/**
 * @param {string} message
 */
export function isBotCommand(message) {
  const text = String(message ?? '').trim();
  if (!text.startsWith('/')) return false;
  const head = text.split(/\s+/)[0].toLowerCase().split('@')[0];
  return BOT_COMMANDS.includes(head) || /^\/[a-z0-9_]{2,32}$/i.test(head);
}

/**
 * Bot name / @mention address (not mid-word).
 * @param {string} message
 * @param {{ botUsername?: string|null }} [opts]
 */
export function isBotNameAddress(message, opts = {}) {
  const text = String(message ?? '').trim();
  if (!text) return false;
  const folded = foldTr(text);
  if (/(?:^|[\s])@?atlas(?:[\s,!?.:;…]|$)/u.test(folded)) return true;
  if (/^@?atlas\b/u.test(folded)) return true;
  const uname = String(opts.botUsername || '')
    .replace(/^@/, '')
    .toLowerCase();
  if (uname && uname !== 'atlas') {
    const re = new RegExp(`(?:^|[\\s])@?${uname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[\\s,!?.:;…]|$)`, 'iu');
    if (re.test(text.toLowerCase())) return true;
  }
  return false;
}

/**
 * Presence / wake checks — never identity or name resolution.
 * @param {string} message
 * @returns {{ active: boolean, reply: string|null }}
 */
export function detectPresenceCheck(message) {
  const text = String(message ?? '').trim();
  if (!text || text.length > 48) return { active: false, reply: null };
  if (/^\?{1,3}$/u.test(text)) {
    return { active: true, reply: 'Evet.' };
  }
  const folded = foldTr(text)
    .replace(/[?.!…]+$/g, '')
    .trim();

  if (
    /^(?:ordamisin|orada\s*misin|burada\s*misin|burdamisin)$/u.test(folded) ||
    /^(?:atlas)\s*$/u.test(folded) ||
    /^(?:hey|hi|alo)\s+atlas$/u.test(folded)
  ) {
    return { active: true, reply: 'Buradayım.' };
  }
  if (/^dinliyor\s*musun$/u.test(folded)) {
    return { active: true, reply: 'Dinliyorum.' };
  }
  if (/^(?:aktif\s*misin|ses\s*ver)$/u.test(folded)) {
    return { active: true, reply: 'Evet.' };
  }
  return { active: false, reply: null };
}

/**
 * Strip leading bot address so resolvers see the payload.
 * @param {string} message
 * @param {{ botUsername?: string|null }} [opts]
 */
export function stripBotAddressPrefix(message, opts = {}) {
  let text = String(message ?? '').trim();
  if (!text) return text;
  text = text.replace(/^@?atlas\b\s*[,:;]?\s*/iu, '');
  const uname = String(opts.botUsername || '')
    .replace(/^@/, '')
    .trim();
  if (uname) {
    const esc = uname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^@?${esc}\\b\\s*[,:;]?\\s*`, 'iu'), '');
  }
  return text.trim() || String(message ?? '').trim();
}

/**
 * Explicit session end.
 * @param {string} message
 */
export function isExplicitSessionEnd(message) {
  const folded = foldTr(message)
    .replace(/[?.!…]+$/g, '')
    .trim();
  if (!folded || folded.length > 60) return false;
  return /^(?:tamam(?:dir)?|tamam\s+tesekkur(?:ler)?|gorusuruz|hosca\s*kal|bay\s*bay|bye|kapat|bitir|sus|yeter(?:li)?|konuyu\s+kapatalim|konusmayi\s+bitir(?:elim)?)$/u.test(
    folded,
  );
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 * @param {number} [nowMs]
 */
export function getActivationSession(conversationId, userId, nowMs = Date.now()) {
  const key = sessionKey(conversationId, userId);
  const session = sessions.get(key);
  if (!session) return null;
  const last = Date.parse(session.lastActiveAt) || 0;
  if (nowMs - last > SESSION_IDLE_MS) {
    sessions.delete(key);
    return null;
  }
  return session;
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function hasActiveSession(conversationId, userId) {
  return Boolean(getActivationSession(conversationId, userId));
}

/**
 * @param {{
 *   conversationId: string,
 *   userId?: string|null,
 *   reason?: string|null,
 *   intent?: string|null,
 *   topic?: string|null,
 * }} input
 */
export function touchActivationSession(input) {
  const conversationId = String(input.conversationId || 'default');
  const userId = input.userId || 'anon';
  const key = sessionKey(conversationId, userId);
  const now = new Date().toISOString();
  const prev = sessions.get(key);
  /** @type {ActivationSession} */
  const next = {
    conversationId,
    userId,
    startedAt: prev?.startedAt || now,
    lastActiveAt: now,
    intent: input.intent ?? prev?.intent ?? null,
    topic: input.topic ?? prev?.topic ?? null,
    activationReason: input.reason ?? prev?.activationReason ?? null,
  };
  sessions.set(key, next);
  return next;
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function closeActivationSession(conversationId, userId) {
  sessions.delete(sessionKey(conversationId, userId));
}

/** Test helper */
export function resetActivationSessionsForTests() {
  sessions.clear();
}

/**
 * @param {{
 *   message: string,
 *   conversationId?: string,
 *   userId?: string|null,
 *   channel?: string|null,
 *   isGroup?: boolean,
 *   metadata?: {
 *     replyToBot?: boolean,
 *     addressedToBot?: boolean,
 *     isCommand?: boolean,
 *     botUsername?: string|null,
 *     chatType?: string|null,
 *   }|null,
 * }} input
 */
export function evaluateActivation(input) {
  const message = String(input.message ?? '').trim();
  const conversationId = String(input.conversationId ?? 'default');
  const userId = input.userId || null;
  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const isGroup = Boolean(
    input.isGroup ??
      meta.isGroup ??
      (meta.chatType === 'group' || meta.chatType === 'supergroup'),
  );
  const botUsername = meta.botUsername ?? null;

  const presence = detectPresenceCheck(message);
  const command =
    meta.isCommand === true || isBotCommand(message);
  const named = isBotNameAddress(message, { botUsername });
  const replyToBot = meta.replyToBot === true;
  const addressedFlag = meta.addressedToBot === true;
  const addressed = addressedFlag || named || replyToBot || command || presence.active;

  const existing = getActivationSession(conversationId, userId);

  /** @type {string} */
  let decision = 'no_response';
  /** @type {string} */
  let reason = 'default_silent';
  let skipResolvers = false;
  let effectiveMessage = message;
  /** @type {string|null} */
  let presenceReply = null;
  /** @type {ActivationSession|null} */
  let session = existing;

  // Explicit end while session open
  if (existing && isExplicitSessionEnd(message)) {
    closeActivationSession(conversationId, userId);
    return {
      decision: 'session_end',
      reason: 'explicit_end',
      isGroup,
      addressed,
      skipResolvers: true,
      effectiveMessage: message,
      presenceReply: 'Tamam.',
      session: null,
      noResponse: false,
      version: CONVERSATION_ACTIVATION_VERSION,
    };
  }

  if (presence.active) {
    decision = 'presence';
    reason = 'presence_check';
    presenceReply = presence.reply;
    skipResolvers = true;
    session = touchActivationSession({
      conversationId,
      userId,
      reason: 'presence',
      intent: 'presence_check',
    });
  } else if (!isGroup) {
    // DM / web — first message starts session; follow-ups continue
    if (existing) {
      const rearm =
        command ||
        (named && stripBotAddressPrefix(message, { botUsername }).length >= 2);
      if (rearm) {
        decision = 'activate';
        reason = command ? 'command' : named ? 'bot_name_rearm' : 'dm_rearm';
        skipResolvers = false;
        if (named) {
          effectiveMessage = stripBotAddressPrefix(message, { botUsername });
        }
        session = touchActivationSession({
          conversationId,
          userId,
          reason,
          intent: command ? 'command' : existing.intent,
        });
      } else {
        decision = 'continue';
        reason = 'active_session_dm';
        skipResolvers = true;
        session = touchActivationSession({
          conversationId,
          userId,
          reason: existing.activationReason || 'dm',
        });
      }
    } else {
      decision = 'activate';
      reason = command ? 'command' : named ? 'bot_name' : 'dm_first_message';
      skipResolvers = false;
      if (named) {
        effectiveMessage = stripBotAddressPrefix(message, { botUsername });
      }
      session = touchActivationSession({
        conversationId,
        userId,
        reason,
        intent: command ? 'command' : null,
      });
    }
  } else if (existing) {
    // Group/DM active session — follow-ups without re-mention.
    // Fresh command or bot-name + payload re-arms resolvers for a new ask.
    const rearm =
      command ||
      (named && stripBotAddressPrefix(message, { botUsername }).length >= 2);
    if (rearm) {
      decision = 'activate';
      reason = command ? 'command' : 'bot_name_rearm';
      skipResolvers = false;
      if (named) {
        effectiveMessage = stripBotAddressPrefix(message, { botUsername });
      }
      session = touchActivationSession({
        conversationId,
        userId,
        reason,
        intent: command ? 'command' : existing.intent,
      });
    } else {
      decision = 'continue';
      reason = isGroup ? 'active_session_group' : 'active_session_dm';
      skipResolvers = true;
      session = touchActivationSession({
        conversationId,
        userId,
        reason: existing.activationReason || (isGroup ? 'group' : 'dm'),
      });
    }
  } else if (addressed) {
    decision = 'activate';
    reason = replyToBot
      ? 'reply_to_bot'
      : command
        ? 'command'
        : named || addressedFlag
          ? 'bot_name'
          : 'addressed';
    skipResolvers = false;
    if (named) {
      effectiveMessage = stripBotAddressPrefix(message, { botUsername });
    }
    session = touchActivationSession({
      conversationId,
      userId,
      reason,
      intent: command ? 'command' : null,
    });
  } else {
    decision = 'no_response';
    reason = 'group_not_addressed';
    skipResolvers = true;
    session = null;
  }

  return {
    decision,
    reason,
    isGroup,
    addressed,
    skipResolvers,
    effectiveMessage,
    presenceReply,
    session,
    noResponse: decision === 'no_response',
    version: CONVERSATION_ACTIVATION_VERSION,
  };
}

/**
 * Cheap Telegram edge check — avoid typing/POST when clearly silent.
 * @param {{
 *   message: string,
 *   conversationId: string,
 *   userId?: string|null,
 *   isGroup: boolean,
 *   addressedToBot: boolean,
 * }} input
 */
export function shouldForwardGroupMessage(input) {
  if (!input.isGroup) return true;
  if (input.addressedToBot) return true;
  if (detectPresenceCheck(input.message).active) return true;
  if (isBotCommand(input.message)) return true;
  if (hasActiveSession(input.conversationId, input.userId)) return true;
  return false;
}
