// ═══════════════════════════════════════════════════════════════════════
// Symbolic calendar layer — Gregorian + calculated Hijri (not LLM memory)
//
// Hijri method: Kuwaiti / Fliegel–Van Flandern arithmetic algorithm
// (common computational approximation; may differ ±1 day from local hilal).
// ═══════════════════════════════════════════════════════════════════════

const WEEKDAYS_TR = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];

const HIJRI_MONTHS_TR = [
  'Muharrem',
  'Safer',
  'Rebiülevvel',
  'Rebiülahir',
  'Cemaziyelevvel',
  'Cemaziyelahir',
  'Receb',
  'Şaban',
  'Ramazan',
  'Şevval',
  'Zilkade',
  'Zilhicce',
];

/** Symbolic themes for analysis framing — not religious rulings. */
const HIJRI_MONTH_THEMES = {
  1: 'yenilenme, niyet ve başlangıç',
  2: 'sadeleşme ve iç düzen',
  3: 'iletişim ve bağ kurma',
  4: 'sabır ve olgunlaşma',
  5: 'hareket ve görünürlük',
  6: 'derinleşme ve içsel toparlanma',
  7: 'yükseliş ve manevi dikkat',
  8: 'hazırlık ve arınma',
  9: 'disiplin, sadeleşme ve farkındalık',
  10: 'açılma ve paylaşım',
  11: 'toplanma ve değerlendirme',
  12: 'tamamlanma ve geçiş',
};

/**
 * Kuwaiti algorithm: Gregorian → Hijri.
 * @param {number} gy
 * @param {number} gm 1-12
 * @param {number} gd
 * @returns {{ hy: number, hm: number, hd: number }}
 */
export function gregorianToHijri(gy, gm, gd) {
  const jd =
    Math.floor((1461 * (gy + 4800 + Math.floor((gm - 14) / 12))) / 4) +
    Math.floor((367 * (gm - 2 - 12 * Math.floor((gm - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((gy + 4900 + Math.floor((gm - 14) / 12)) / 100)) / 4) +
    gd -
    32075;

  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hm = Math.floor((24 * l3) / 709);
  const hd = l3 - Math.floor((709 * hm) / 24);
  const hy = 30 * n + j - 30;
  return { hy, hm, hd };
}

/**
 * @param {number} dayInMonth
 * @returns {'baslangic'|'orta'|'son'}
 */
export function hijriMonthSection(dayInMonth) {
  const d = Number(dayInMonth);
  if (d <= 10) return 'baslangic';
  if (d <= 20) return 'orta';
  return 'son';
}

export function hijriMonthSectionLabelTr(section) {
  if (section === 'baslangic') return 'ayın başlangıcı (1–10)';
  if (section === 'orta') return 'ayın orta bölümü (11–20)';
  return 'ayın son bölümü (21–son)';
}

/**
 * @param {Date|string|number} [when]
 * @param {string} [timeZone]
 */
export function buildSymbolicCalendarContext(when = new Date(), timeZone = 'Europe/Istanbul') {
  const date = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(date.getTime())) {
    return {
      ok: false,
      error: 'INVALID_DATE',
      metadata: { method: 'none' },
    };
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const gy = Number(get('year'));
  const gm = Number(get('month'));
  const gd = Number(get('day'));

  const weekdayTr = new Intl.DateTimeFormat('tr-TR', {
    timeZone,
    weekday: 'long',
  }).format(date);

  const hijri = gregorianToHijri(gy, gm, gd);
  const section = hijriMonthSection(hijri.hd);
  const monthName = HIJRI_MONTHS_TR[hijri.hm - 1] ?? `Ay ${hijri.hm}`;

  return {
    ok: true,
    timeZone,
    gregorian: {
      isoDate: `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`,
      year: gy,
      month: gm,
      day: gd,
      weekday: weekdayTr,
      weekdaysCanonical: WEEKDAYS_TR,
    },
    hijri: {
      year: hijri.hy,
      month: hijri.hm,
      day: hijri.hd,
      monthName,
      section,
      sectionLabel: hijriMonthSectionLabelTr(section),
      symbolicTheme: HIJRI_MONTH_THEMES[hijri.hm] ?? null,
      display: `${hijri.hd} ${monthName} ${hijri.hy}`,
    },
    metadata: {
      method: 'kuwaiti-arithmetic',
      methodLabel:
        'Hesaplanan Hicri tarih (Kuwaiti / aritmetik algoritma). Hilal gözlemine göre ±1 gün fark olabilir; dini/resmî işlemlerde yerel resmî takvim esas alınmalıdır.',
      source: 'atlas-symbolic-calendar',
      approximate: true,
    },
  };
}

/**
 * Format calendar facts for model injection (not user-facing dump).
 * @param {ReturnType<typeof buildSymbolicCalendarContext>} ctx
 */
export function formatCalendarDataBlock(ctx) {
  if (!ctx?.ok) {
    return `## VERIFIED CALENDAR DATA
Hicri tarih hesaplanamadı. Hicri tarih uydurma. Belirsizliği açıkça belirt.`;
  }

  return `## VERIFIED CALENDAR DATA (use only these dates)
Miladi: ${ctx.gregorian.isoDate} (${ctx.gregorian.weekday})
Saat dilimi: ${ctx.timeZone}
Hesaplanan Hicri: ${ctx.hijri.display}
Hicri ay: ${ctx.hijri.monthName}
Hicri ayın günü: ${ctx.hijri.day}
Hicri ay bölümü (sembolik): ${ctx.hijri.sectionLabel}
Hicri ay sembolik teması: ${ctx.hijri.symbolicTheme ?? '—'}
Kaynak/yöntem: ${ctx.metadata.methodLabel}
Kurallar:
- Hicri tarihi model hafızandan tahmin etme.
- Bu bölümlendirmeyi mutlak dini hüküm gibi sunma; sembolik analiz amacıyla kullanıldığını belirt.
- Dini ibadet veya resmî tarih için yerel resmî takvimin esas alınması gerektiğini gerektiğinde belirt.`;
}
