// ═══════════════════════════════════════════════════════════════════════
// Prime "Today" — assembles Prime Home's personalized snapshot.
// Every field traces to a real source; nothing here is invented text.
//
// COST: this module is deterministic. It never imports or calls the
// OpenAI client. Numerology + natal are local engines. Check-in, outlook,
// and memory continuity are stored/computed data. Ordinary home refresh
// therefore produces zero model calls.
// ═══════════════════════════════════════════════════════════════════════

import { getPrimeProfile, profileCompleteness } from './profile.js';
import { calculateNatalFromMemory } from '../natal-engine/index.js';
import { runNumerologyAnalysis } from '../numerology-engine/orchestrator.js';
import { listUserConversations } from '../conversations.js';
import { getChatUsageSnapshot } from '../usage/chat-usage.js';
import { resolveEntitlements, hasCapability } from '../entitlements/resolve.js';
import { CAPABILITIES } from '../entitlements/capabilities.js';
import { getTodayCheckin, getPreviousCheckin, civilDateKey } from './checkin.js';
import { buildSevenDayOutlookTracked } from './outlook.js';
import { buildMemoryContinuity } from './memory.js';

export const PRIME_HOME_COST = Object.freeze({
  mode: 'deterministic',
  aiCalls: 0,
  note: 'Ordinary Prime home refresh does not call the model.',
});

function greeting(displayName) {
  const hour = new Date().getHours();
  const part = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  // Never fabricate a name — generic greeting when none is set.
  return displayName ? `${part}, ${displayName}.` : `${part}.`;
}

/**
 * @param {object} profile from getPrimeProfile
 */
function buildSymbolicSnapshot(profile) {
  const snapshot = { numerology: null, natal: null };

  if (profile.birth.date) {
    try {
      const num = runNumerologyAnalysis({
        birthDate: profile.birth.date,
        fullName: profile.displayName || undefined,
      });
      if (num?.birthChart?.ok !== false && num?.ok !== false) {
        snapshot.numerology = {
          available: true,
          lifePath: num.birthChart?.lifePath?.value ?? null,
          provenance: 'server/numerology-engine — computed from profile.birth.date',
        };
      }
    } catch {
      snapshot.numerology = null;
    }
  }

  return snapshot;
}

function buildNatalSnapshot(userId, profile) {
  if (!profile.birth.date) return null;
  try {
    const chart = calculateNatalFromMemory(userId);
    if (!chart?.ok) return { available: false, reason: chart?.error?.code ?? 'unavailable' };
    const sun = chart.points?.find((p) => p.body === 'Sun');
    return {
      available: true,
      sunSign: sun?.signTr ?? sun?.sign ?? null,
      fullChartAvailable: Boolean(chart.dataQuality?.fullChartAvailable),
      birthTimeKnown: Boolean(chart.dataQuality?.birthTimeKnown),
      warnings: chart.dataQuality?.warnings ?? [],
      provenance: 'server/natal-engine — computed from profile.birth (date/time/place/timezone)',
    };
  } catch {
    return { available: false, reason: 'calculation_failed' };
  }
}

function conversationPreview(conversation) {
  if (!conversation) return null;
  return {
    id: conversation.id,
    updatedAt: conversation.updatedAt,
    preview: conversation.preview,
    messageCount: conversation.messageCount,
  };
}

function completenessNote(completeness) {
  if (!completeness) return 'Bugünün kişisel görünümünü genişletmek için profil bilgilerini tamamlayabilirsin.';
  if (!completeness.hasBirthDate) {
    return 'Bugünün kişisel görünümünü genişletmek için profil bilgilerini tamamlayabilirsin.';
  }
  if (!completeness.natalHousesAvailable) {
    return 'Doğum saatini eklersen yükselen ve ev hesaplamaları kullanılabilir.';
  }
  return null;
}

/**
 * @param {string} userId
 * @param {{ authenticated: boolean, isAnonymous?: boolean, roles?: string[] }} auth
 */
export function buildPrimeToday(userId, auth) {
  const profileResult = getPrimeProfile(userId);
  const profile = profileResult.ok ? profileResult.profile : null;
  const completeness = profile ? profileCompleteness(profile) : null;

  let resolved;
  try {
    resolved = resolveEntitlements(auth || {});
  } catch {
    resolved = { plan: 'free', entitlements: {} };
  }
  const usage = getChatUsageSnapshot(userId, resolved.plan);
  const primeWorld = hasCapability(resolved.entitlements, CAPABILITIES.PRIME_WORLD);

  let latestConversation = null;
  try {
    const list = listUserConversations(userId);
    latestConversation = list[0] ?? null;
  } catch {
    latestConversation = null;
  }

  const timezone = profile?.birth?.timezone || null;
  const date = civilDateKey(timezone);

  let checkIn = { date, checkin: null, frequency: null };
  let previousCheckin = null;
  if (primeWorld) {
    try {
      const todayCheckin = getTodayCheckin(userId, { timezone });
      if (todayCheckin.ok) checkIn = todayCheckin;
      previousCheckin = getPreviousCheckin(userId, { timezone });
    } catch {
      checkIn = { date, checkin: null, frequency: null };
    }
  }

  let outlook = {
    available: false,
    items: [],
    reason: primeWorld ? 'insufficient_data' : 'prime_required',
    message: primeWorld
      ? 'Önümüzdeki 7 gün için kayıtlı bir madde yok. Profil ve günlük check-in görünümü genişletir.'
      : '7 günlük görünüm Lara Prime ile açılır.',
    cost: { mode: 'deterministic', aiCalls: 0 },
  };
  if (primeWorld) {
    try {
      outlook = buildSevenDayOutlookTracked({
        profile,
        checkin: checkIn.checkin,
        timezone,
      });
    } catch {
      outlook = {
        available: false,
        items: [],
        reason: 'error',
        message: '7 günlük görünüm şu an hesaplanamadı.',
        cost: { mode: 'deterministic', aiCalls: 0 },
      };
    }
  }

  let memoryContinuity = {
    available: false,
    statement: null,
    kind: null,
    action: { label: 'Atlas ile konuş', href: '/atlas' },
  };
  try {
    memoryContinuity = buildMemoryContinuity(userId);
  } catch {
    /* keep empty continuity */
  }

  return {
    greeting: greeting(profile?.displayName ?? null),
    date,
    profile: {
      completeness,
      note: completenessNote(completeness),
    },
    symbolic: profile ? buildSymbolicSnapshot(profile) : { numerology: null, natal: null },
    natal: profile ? buildNatalSnapshot(userId, profile) : null,
    continueConversation: conversationPreview(latestConversation),
    usage: { plan: resolved.plan, dailyUsed: usage.used, dailyLimit: usage.limit },
    checkIn: primeWorld
      ? {
          date: checkIn.date,
          record: checkIn.checkin,
          frequency: checkIn.frequency,
          previous: previousCheckin
            ? {
                date: previousCheckin.date,
                energy: previousCheckin.energy,
                focus: previousCheckin.focus,
                // Intention is the user's own words — only shown to the owner via this payload.
                intention: previousCheckin.intention,
              }
            : null,
        }
      : null,
    outlook,
    memoryContinuity,
    primeWorld,
    cost: PRIME_HOME_COST,
  };
}
