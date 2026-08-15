// ═══════════════════════════════════════════════════════════════════════
// Prime 7-day outlook — deterministic, evidence-based, no LLM.
//
// COST: this module never calls OpenAI. It uses:
//   - saved profile (birthday window)
//   - existing hijri conversion (month-start in window)
//   - existing moon-phase ephemeris (nearest phase if within 7 days)
//   - today's check-in (optional "hold this intention" item)
// If none of those sources produce a dated item, the result is an honest
// empty state. Nothing astronomical, astrological, or numerological is
// invented.
// ═══════════════════════════════════════════════════════════════════════

import { computeMoonPhaseDetails } from '../atlas-ephemeris.js';
import { gregorianToHijri, hijriMonthNameTr } from '../atlas-symbolic-calendar.js';
import { civilDateKey } from './checkin.js';

const SYNODIC_MONTH_DAYS = 29.530588853;
const HORIZON_DAYS = 7;

export const OUTLOOK_COST = Object.freeze({
  mode: 'deterministic',
  aiCalls: 0,
  cached: false,
  note: '7-day outlook is computed from profile + calendar + ephemeris. No model call.',
});

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function daysUntilNextBirthday(birthDate, fromDate) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!parts) return null;
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const fromParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromDate);
  if (!fromParts) return null;
  const fy = Number(fromParts[1]);
  const fm = Number(fromParts[2]);
  const fd = Number(fromParts[3]);

  const thisYear = `${fy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Invalid calendar dates (e.g. Feb 29 in a non-leap year) — skip rather than invent.
  const probe = new Date(`${thisYear}T00:00:00Z`);
  if (Number.isNaN(probe.getTime()) || probe.getUTCDate() !== day) return null;

  if (thisYear === fromDate) return { date: thisYear, days: 0 };
  if (thisYear > fromDate) {
    const a = Date.UTC(fy, fm - 1, fd);
    const b = Date.UTC(fy, month - 1, day);
    return { date: thisYear, days: Math.round((b - a) / 86400000) };
  }
  const nextYear = `${fy + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(fy + 1, month - 1, day);
  if (Number.isNaN(b)) return null;
  return { date: nextYear, days: Math.round((b - a) / 86400000) };
}

function daysUntilAngle(phaseDeg, targetDeg) {
  const delta = (targetDeg - phaseDeg + 360) % 360;
  return (delta / 360) * SYNODIC_MONTH_DAYS;
}

function moonItems(fromDate) {
  const details = computeMoonPhaseDetails(`${fromDate}T12:00:00Z`);
  if (!details?.ok || !Number.isFinite(details.phaseAngleDegrees)) return [];

  const candidates = [
    { key: 'newMoon', target: 0, title: 'Yeni Ay', label: 'gökyüzü' },
    { key: 'fullMoon', target: 180, title: 'Dolunay', label: 'gökyüzü' },
  ];

  const items = [];
  for (const c of candidates) {
    const days = daysUntilAngle(details.phaseAngleDegrees, c.target);
    if (days < 0 || days > HORIZON_DAYS) continue;
    const date = addDays(fromDate, Math.round(days));
    items.push({
      date,
      window: date === fromDate ? 'Bugün' : date,
      title: `${c.title} (${c.label})`,
      why: 'Astronomik hesap — kişisel bir kehanet değil.',
      action: null,
      provenance: 'server/atlas-ephemeris computeMoonPhaseDetails',
    });
  }
  return items;
}

function hijriMonthStartItems(fromDate) {
  const items = [];
  for (let i = 0; i < HORIZON_DAYS; i += 1) {
    const date = addDays(fromDate, i);
    const [y, m, d] = date.split('-').map(Number);
    try {
      const hijri = gregorianToHijri(y, m, d);
      if (hijri?.hd !== 1) continue;
      const monthName = hijriMonthNameTr(hijri.hm);
      items.push({
        date,
        window: date === fromDate ? 'Bugün' : date,
        title: `${monthName} ayı başlıyor`,
        why: 'Hicri takvim dönüşümü (Umm al-Qura / ICU) — kişisel bir yorum değil.',
        action: null,
        provenance: 'server/atlas-symbolic-calendar gregorianToHijri',
      });
    } catch {
      /* skip a day that cannot convert */
    }
  }
  return items;
}

function birthdayItem(profile, fromDate) {
  const birthDate = profile?.birth?.date;
  if (!birthDate) return null;
  const upcoming = daysUntilNextBirthday(birthDate, fromDate);
  if (!upcoming || upcoming.days < 0 || upcoming.days > HORIZON_DAYS) return null;
  return {
    date: upcoming.date,
    window: upcoming.days === 0 ? 'Bugün' : upcoming.date,
    title: 'Doğum günün',
    why: 'Kayıtlı doğum tarihinden.',
    action: { label: 'Atlas ile konuş', href: '/atlas' },
    provenance: 'prime.profile.birth.date',
  };
}

function checkinIntentionItem(checkin, fromDate) {
  if (!checkin?.intention || checkin.date !== fromDate) return null;
  return {
    date: fromDate,
    window: 'Bugün',
    title: 'Bugünkü niyetin',
    why: 'Bugünkü check-in’de yazdığın niyet.',
    action: { label: 'Atlas ile devam et', href: '/atlas' },
    provenance: 'prime.checkin.intention',
  };
}

/**
 * @param {{
 *   profile?: object|null,
 *   checkin?: object|null,
 *   timezone?: string|null,
 *   now?: Date,
 * }} input
 */
export function buildSevenDayOutlook(input = {}) {
  const fromDate = civilDateKey(input.timezone || input.profile?.birth?.timezone, input.now);
  const items = [];

  const birthday = birthdayItem(input.profile, fromDate);
  if (birthday) items.push(birthday);

  const intention = checkinIntentionItem(input.checkin, fromDate);
  if (intention) items.push(intention);

  for (const item of hijriMonthStartItems(fromDate)) items.push(item);
  for (const item of moonItems(fromDate)) items.push(item);

  // Deduplicate by date+title in case moon rounding collides.
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = `${item.date}|${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  unique.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (unique.length === 0) {
    return {
      available: false,
      items: [],
      reason: 'insufficient_data',
      message: 'Önümüzdeki 7 gün için kayıtlı bir madde yok. Profil ve günlük check-in görünümü genişletir.',
      horizonDays: HORIZON_DAYS,
      cost: OUTLOOK_COST,
    };
  }

  return {
    available: true,
    items: unique,
    reason: null,
    message: null,
    horizonDays: HORIZON_DAYS,
    cost: OUTLOOK_COST,
  };
}

/** In-process generation counter — admin observability, not a billing meter. */
let outlookBuildCount = 0;

export function buildSevenDayOutlookTracked(input) {
  outlookBuildCount += 1;
  return buildSevenDayOutlook(input);
}

export function getOutlookBuildCount() {
  return outlookBuildCount;
}

export function resetOutlookBuildCountForTests() {
  outlookBuildCount = 0;
}
