// ═══════════════════════════════════════════════════════════════════════
// Prime "Today" — assembles Prime Home's personalized snapshot.
// Every field traces to a real source; nothing here is invented text.
// ═══════════════════════════════════════════════════════════════════════

import { getPrimeProfile, profileCompleteness } from './profile.js';
import { calculateNatalFromMemory } from '../natal-engine/index.js';
import { runNumerologyAnalysis } from '../numerology-engine/orchestrator.js';
import { listUserConversations } from '../conversations.js';
import { getChatUsageSnapshot } from '../usage/chat-usage.js';
import { resolveEntitlements } from '../entitlements/resolve.js';

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
    resolved = { plan: 'free' };
  }
  const usage = getChatUsageSnapshot(userId, resolved.plan);

  let latestConversation = null;
  try {
    const list = listUserConversations(userId);
    latestConversation = list[0] ?? null;
  } catch {
    latestConversation = null;
  }

  return {
    greeting: greeting(profile?.displayName ?? null),
    date: new Date().toISOString().slice(0, 10),
    profile: {
      completeness,
      note: completeness?.hasBirthDate
        ? completeness.natalHousesAvailable
          ? null
          : 'Doğum saatini eklersen yükselen ve ev hesaplamaları kullanılabilir.'
        : 'Bugünün kişisel görünümünü genişletmek için profil bilgilerini tamamlayabilirsin.',
    },
    symbolic: profile ? buildSymbolicSnapshot(profile) : { numerology: null, natal: null },
    natal: profile ? buildNatalSnapshot(userId, profile) : null,
    continueConversation: conversationPreview(latestConversation),
    usage: { plan: resolved.plan, dailyUsed: usage.used, dailyLimit: usage.limit },
  };
}
