/**
 * Hijri calendar layer tests — Umm al-Qura fixtures + Turkish month names.
 * Reference dates verified against AlAdhan API (calendarMethod=UAQ).
 */
import {
  HIJRI_MONTHS_TR,
  gregorianToHijri,
  gregorianToHijriUmmAlQura,
  gregorianToHijriKuwaiti,
  hijriMonthNameTr,
  hijriMonthSection,
  buildSymbolicCalendarContext,
  formatCalendarDataBlock,
} from '../server/atlas-symbolic-calendar.js';

let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Month names (Diyanet / TR orthography) ──
record('12 month names', HIJRI_MONTHS_TR.length === 12);
record('month 7 is Recep (not Receb)', HIJRI_MONTHS_TR[6] === 'Recep');
record('no Receb spelling', !HIJRI_MONTHS_TR.includes('Receb'));
record(
  'canonical TR list',
  HIJRI_MONTHS_TR.join('|') ===
    'Muharrem|Safer|Rebiülevvel|Rebiülahir|Cemaziyelevvel|Cemaziyelahir|Recep|Şaban|Ramazan|Şevval|Zilkade|Zilhicce',
);
record('hijriMonthNameTr(2)=Safer', hijriMonthNameTr(2) === 'Safer');
record('hijriMonthNameTr(7)=Recep', hijriMonthNameTr(7) === 'Recep');
record('hijriMonthNameTr(9)=Ramazan', hijriMonthNameTr(9) === 'Ramazan');

// ── Umm al-Qura fixtures (AlAdhan UAQ, fetched 2026-07-30) ──
/** @type {Array<{ g: [number, number, number], h: { hy: number, hm: number, hd: number }, label: string }>} */
const UAQ_FIXTURES = [
  { g: [2026, 7, 30], h: { hy: 1448, hm: 2, hd: 16 }, label: '16 Safer 1448' },
  { g: [2026, 7, 31], h: { hy: 1448, hm: 2, hd: 17 }, label: '17 Safer 1448' },
  { g: [2026, 8, 1], h: { hy: 1448, hm: 2, hd: 18 }, label: '18 Safer 1448' },
  { g: [2026, 7, 29], h: { hy: 1448, hm: 2, hd: 15 }, label: '15 Safer 1448' },
  { g: [2026, 6, 15], h: { hy: 1447, hm: 12, hd: 29 }, label: '29 Zilhicce 1447' },
  { g: [2026, 6, 16], h: { hy: 1448, hm: 1, hd: 1 }, label: '1 Muharrem 1448' },
  { g: [2025, 3, 1], h: { hy: 1446, hm: 9, hd: 1 }, label: '1 Ramazan 1446' },
  { g: [2024, 7, 7], h: { hy: 1446, hm: 1, hd: 1 }, label: '1 Muharrem 1446' },
  { g: [2026, 2, 10], h: { hy: 1447, hm: 8, hd: 22 }, label: '22 Şaban 1447' },
];

for (const fx of UAQ_FIXTURES) {
  const [gy, gm, gd] = fx.g;
  const got = gregorianToHijri(gy, gm, gd);
  const ok =
    got.hy === fx.h.hy && got.hm === fx.h.hm && got.hd === fx.h.hd && got.method === 'islamic-umalqura';
  record(
    `UAQ ${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')} → ${fx.label}`,
    ok,
    ok ? got.method : JSON.stringify(got),
  );

  const direct = gregorianToHijriUmmAlQura(gy, gm, gd);
  record(
    `Intl umalqura direct ${gy}-${gm}-${gd}`,
    Boolean(direct && direct.hy === fx.h.hy && direct.hm === fx.h.hm && direct.hd === fx.h.hd),
  );
}

// Document Kuwaiti drift on a known mismatch (must NOT be used as primary).
const kuwaitiDrift = gregorianToHijriKuwaiti(2026, 6, 15);
record(
  'Kuwaiti can differ from UAQ (2026-06-15)',
  !(kuwaitiDrift.hy === 1447 && kuwaitiDrift.hm === 12 && kuwaitiDrift.hd === 29),
  JSON.stringify(kuwaitiDrift),
);

// ── Context builder / display ──
const cal = buildSymbolicCalendarContext(new Date('2026-07-30T12:00:00+03:00'), 'Europe/Istanbul');
record('calendar ok for 2026-07-30 Istanbul', cal.ok === true);
record('display is 16 Safer 1448', cal.hijri?.display === '16 Safer 1448', cal.hijri?.display);
record('method is islamic-umalqura', cal.metadata?.method === 'islamic-umalqura');
record('monthName Safer', cal.hijri?.monthName === 'Safer');
record('section orta for day 16', cal.hijri?.section === 'orta');
record('gregorian iso', cal.gregorian?.isoDate === '2026-07-30');

const aug1 = buildSymbolicCalendarContext(new Date('2026-08-01T12:00:00+03:00'), 'Europe/Istanbul');
record('calendar ok for 2026-08-01 Istanbul', aug1.ok === true);
record('display is 18 Safer 1448', aug1.hijri?.display === '18 Safer 1448', aug1.hijri?.display);
record('Aug 1 must not be Muharrem', !/Muharrem/i.test(aug1.hijri?.display ?? ''));

const muharrem = buildSymbolicCalendarContext(new Date('2026-06-16T12:00:00+03:00'));
record('Muharrem 1 1448 display', muharrem.hijri?.display === '1 Muharrem 1448', muharrem.hijri?.display);

const recepProbe = buildSymbolicCalendarContext(new Date('2027-01-01T12:00:00+03:00'));
// Just ensure if month is 7, name is Recep (date may vary; check name helper path via conversion)
const anyRecep = gregorianToHijri(2027, 1, 5);
if (anyRecep.hm === 7) {
  record('Recep month name when hm=7', hijriMonthNameTr(anyRecep.hm) === 'Recep');
} else {
  record('Recep name helper independent of date', hijriMonthNameTr(7) === 'Recep');
}

record('section 1-10', hijriMonthSection(5) === 'baslangic');
record('section 11-20', hijriMonthSection(15) === 'orta');
record('section 21+', hijriMonthSection(25) === 'son');

record(
  'failure path does not invent',
  /uydurma|hesaplanamadı/i.test(formatCalendarDataBlock({ ok: false, error: 'INVALID_DATE' })),
);

const block = formatCalendarDataBlock(cal);
record('prompt block has verified Hijri', /16 Safer 1448/.test(block) && /VERIFIED CALENDAR/.test(block));
record('prompt block does not say Receb', !/Receb/.test(block));
record(
  'default block does not auto-inject Safer spiritual theme',
  !/sadeleşme ve iç düzen/i.test(block) && !/Hicri ay sembolik teması:/i.test(block),
);
record(
  'spiritual opt-in may frame theme',
  /sadeleşme ve iç düzen/i.test(formatCalendarDataBlock(cal, { allowSymbolicThemes: true })),
);

console.log('');
console.log(`=== Hijri calendar: ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
