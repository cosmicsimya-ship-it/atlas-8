/**
 * Natural-language reply builder for numerology analysis.
 * Skeleton is structural; prose should not feel like a rigid template dump.
 */
import {
  getNumberProfile,
  getMasterAnalysis,
  getKarmicDebtNote,
  getPersonalYearTheme,
} from './meanings.js';
import { ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY, DEPTH_LEVEL } from './methodology.js';

function ageRange(from, to) {
  if (to == null) return `${from}+ yaş`;
  return `${from}–${to} yaş`;
}

/**
 * @param {object} chart
 * @param {object|null} nameChart
 * @param {object} contradictions
 * @param {{
 *   depth?: number,
 *   focus?: string|null,
 *   askedPastLife?: boolean,
 *   exploreMore?: boolean,
 *   layersAlreadyCovered?: string[],
 * }} [opts]
 */
export function buildNumerologyReply(chart, nameChart, contradictions, opts = {}) {
  const depth = opts.depth ?? DEPTH_LEVEL.SHORT;
  const focus = opts.focus || null;
  const covered = new Set(opts.layersAlreadyCovered || []);

  if (!chart?.ok) {
    return 'Numeroloji için geçerli bir doğum tarihi gerekli. Gün.Ay.Yıl olarak paylaşabilirsin.';
  }

  if (focus === 'master') {
    return buildMasterFocusReply(chart, depth);
  }
  if (focus === 'cycles') {
    return buildCyclesFocusReply(chart, depth);
  }
  if (focus === 'karmic' || opts.askedPastLife) {
    return buildKarmicFocusReply(chart, Boolean(opts.askedPastLife), depth);
  }
  if (focus === 'period') {
    return buildPeriodFocusReply(chart);
  }
  if (focus === 'explore' || opts.exploreMore) {
    return buildExploreReply(chart, nameChart, contradictions, covered);
  }

  if (depth <= DEPTH_LEVEL.SHORT) {
    return buildShortReply(chart);
  }
  if (depth >= DEPTH_LEVEL.DEEP) {
    return buildDeepReply(chart, nameChart, contradictions);
  }
  return buildStandardReply(chart, nameChart, contradictions);
}

function buildShortReply(chart) {
  const lp = chart.lifePath;
  const profile = getNumberProfile(lp.value);
  const py = chart.personalYear;
  const active = chart.lifeCycles?.activeCycle || null;
  const sentences = [];

  sentences.push(
    `Doğum tarihinden yaşam yolu ${lp.display} çıkıyor` +
      (lp.formula ? ` (${lp.formula}${lp.steps?.length ? ' → ' + lp.steps.join(' → ') : ''})` : '') +
      '.',
  );

  if (profile?.core) {
    sentences.push(
      `En net okuma: ${clipWords(profile.core, 36)}${/[.!?…]$/.test(String(profile.core).trim()) ? '' : '.'}`,
    );
  }

  const strength = profile?.strengths?.[0] ? clipWords(profile.strengths[0], 16) : '';
  const shadow = profile?.shadows?.[0] ? clipWords(profile.shadows[0], 16) : '';
  if (strength && shadow) {
    sentences.push(`Güçlü uç ${strength}; gölgede ${shadow}.`);
  } else if (shadow) {
    sentences.push(`Gölge ucu: ${shadow}.`);
  } else if (strength) {
    sentences.push(`Güçlü uç: ${strength}.`);
  }

  if (profile?.lifeLesson) {
    sentences.push(
      `Ders tarafı: ${clipWords(profile.lifeLesson, 22)}${/[.!?…]$/.test(String(profile.lifeLesson).trim()) ? '' : '.'}`,
    );
  }

  if (active?.name) {
    const gov = active.governingDisplay ? ` (${active.governingDisplay})` : '';
    sentences.push(`Aktif döngüde ${active.name}${gov} öne çıkıyor.`);
  }

  if (py) {
    const theme = clipWords(getPersonalYearTheme(py.value), 24);
    sentences.push(
      `Şu an kişisel yıl ${py.display}: ${theme}${/[.!?…]$/.test(theme) ? '' : '.'}`,
    );
  }

  sentences.push(
    'Tek sayı hüküm vermez; bu bir yön okuması. İstersen döngüleri veya detaylı raporu açabiliriz.',
  );

  return sentences.filter(Boolean).join(' ');
}

function clipWords(text, maxWords) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ').replace(/[.,;:]+$/u, '')}…`;
}

function buildStandardReply(chart, nameChart, contradictions) {
  const lp = chart.lifePath;
  const bd = chart.birthday;
  const profile = getNumberProfile(lp.value);
  const bdProfile = getNumberProfile(bd.value);
  const parts = [];

  parts.push('## Ana hesap');
  parts.push(
    `${formatDateTr(chart.birthDate)} → digit-sum(${chart.birthDate.replace(/-/g, '')}): ${lp.formula}` +
      (lp.steps.length ? ` → ${lp.steps.join(' → ')}` : '') +
      `. Yaşam yolu: ${lp.display}.`,
  );
  if (lp.isMaster) {
    parts.push(
      `Usta sayı korundu (${ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.school}); indirgenmiş temel frekans ${lp.reduced}.`,
    );
  }
  parts.push(
    `Doğum günü ${bd.display}` +
      (bd.formula !== String(bd.dayOfMonth) ? ` (${bd.formula})` : '') +
      `; ay titreşimi ${chart.monthVibration.display}; yıl titreşimi ${chart.yearVibration.display}.`,
  );

  parts.push('');
  parts.push('## Sayının derin anlamı');
  if (lp.isMaster) {
    parts.push(buildMasterInline(lp.value));
  } else if (profile) {
    parts.push(
      `Asıl nokta ${lp.value} demek değil; bu frekansın sende nasıl çalıştığı. ` +
        `Aktifken: ${profile.strengths.slice(0, 3).join(', ')}. ` +
        `Pasif/gölgede: ${profile.shadows.slice(0, 3).join(', ')}.`,
    );
    parts.push(`Temel yaşam dersi: ${profile.lifeLesson}`);
  }

  parts.push('');
  parts.push('## Yaşam döngüleri');
  parts.push(formatCyclesBlock(chart));

  parts.push('');
  parts.push('## Şu anki dönem');
  parts.push(formatPeriodBlock(chart));

  parts.push('');
  parts.push('## Güçlü ve gölge taraf');
  if (profile) {
    parts.push(`Güçlü: ${profile.strengths.join(', ')}.`);
    parts.push(`Gölge: ${profile.shadows.join(', ')}.`);
  }
  if (bdProfile && bd.value !== lp.value) {
    parts.push(
      `Doğum günü ${bd.display} ek renk katıyor: ${bdProfile.core}`,
    );
  }

  parts.push('');
  parts.push('## İlişkiler ve kariyer');
  if (profile) {
    parts.push(`İlişki: ${profile.relationships}`);
    parts.push(`Kariyer/üretim: ${profile.career}`);
  }

  if (contradictions?.tensions?.length) {
    parts.push('');
    parts.push('## Sayılar arası gerilim');
    for (const t of contradictions.tensions.slice(0, 3)) {
      parts.push(`• ${t.reading}`);
    }
  }

  parts.push('');
  parts.push('## Karmik / sembolik tema');
  parts.push(formatKarmicBrief(chart));

  parts.push('');
  parts.push('## Gelişim anahtarı');
  if (profile) parts.push(profile.development);
  if (chart.missingVibrations?.length) {
    parts.push(
      `Profilde zayıf/eksik titreşimler: ${chart.missingVibrations.join(', ')} — bu alanlar bilinçli gelişim kapısı olabilir.`,
    );
  }

  parts.push('');
  parts.push('## Daha ileri analiz');
  if (nameChart?.ok) {
    parts.push(
      `İsim katmanı açık: İfade ${nameChart.expression.display}, Ruh arzusu ${nameChart.soulUrge.display}, Kişilik ${nameChart.personality.display}.`,
    );
  } else {
    parts.push(
      'Ad ve soyadını paylaşırsan İfade, Ruh Arzusu, Kişilik ve isim–doğum uyumunu da açarım. Eksik veri için tahmin yapmam.',
    );
  }

  parts.push('');
  parts.push(
    `_Metodoloji: ${ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId} — ${ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.school}. Farklı ekoller farklı sonuç verebilir._`,
  );

  return parts.join('\n');
}

function buildDeepReply(chart, nameChart, contradictions) {
  const base = buildStandardReply(chart, nameChart, contradictions);
  const extra = [];

  extra.push('');
  extra.push('## Zirve (Pinnacle) dönemleri');
  for (const p of chart.pinnacles || []) {
    const prof = getNumberProfile(p.value);
    const active = chart.activePinnacleIndex === p.index ? ' ← aktif' : '';
    extra.push(
      `• Zirve ${p.index} (${ageRange(p.ageFrom, p.ageTo)}): ${p.display} — ${p.formula}` +
        (prof ? ` — ${prof.label}` : '') +
        active,
    );
  }

  extra.push('');
  extra.push('## Mücadele (Challenge) sayıları');
  for (const c of chart.challenges || []) {
    const prof = getNumberProfile(c.value);
    extra.push(
      `• Mücadele ${c.index}: ${c.display} (${c.formula})` +
        (prof ? ` — ders: ${prof.lifeLesson}` : ''),
    );
  }

  if (chart.repeatingMotifs?.length) {
    extra.push('');
    extra.push('## Tekrarlayan sayısal motifler');
    extra.push(
      chart.repeatingMotifs
        .map((m) => `${m.value} (${m.count}×)`)
        .join(', '),
    );
  }

  if (chart.masterPresence?.length) {
    extra.push('');
    extra.push('## Usta sayı katmanı');
    for (const m of chart.masterPresence) {
      extra.push(buildMasterInline(m.value));
    }
  }

  if (contradictions?.tensions?.length > 3) {
    extra.push('');
    extra.push('## Ek çelişkiler');
    for (const t of contradictions.tensions.slice(3)) {
      extra.push(`• ${t.reading}`);
    }
  }

  if (nameChart?.ok) {
    extra.push('');
    extra.push('## İsim numerolojisi');
    extra.push(
      `İfade ${nameChart.expression.display} (${nameChart.expression.formula.split('=').pop()?.trim() || ''}).`,
    );
    extra.push(`Ruh arzusu ${nameChart.soulUrge.display}; kişilik ${nameChart.personality.display}.`);
    if (nameChart.maturity) {
      extra.push(`Olgunluk ${nameChart.maturity.display}.`);
    }
    if (nameChart.missingLetterVibrations?.length) {
      extra.push(
        `İsimde eksik harf titreşimleri: ${nameChart.missingLetterVibrations.join(', ')}.`,
      );
    }
  }

  extra.push('');
  extra.push('## Metodoloji sınırı');
  extra.push(ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.disclaimer);
  for (const d of ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.disputedAreas.slice(0, 2)) {
    extra.push(`• ${d}`);
  }

  return `${base}\n${extra.join('\n')}`;
}

function buildMasterFocusReply(chart, depth) {
  const masters = chart.masterPresence?.length
    ? chart.masterPresence
    : chart.lifePath?.isMaster
      ? [{ value: chart.lifePath.value, display: chart.lifePath.display }]
      : [];
  if (!masters.length) {
    return (
      `Bu profilde korunan usta sayı (11/22/33) görünmüyor. ` +
      `Ana yol ${chart.lifePath.display}. İstersen yaşam döngüsü veya kişisel yıl katmanına bakabiliriz.`
    );
  }
  const parts = ['Usta sayıyı “sezgisel” diye geçiştirmek yetmez; çift frekansı birlikte okumak gerekir.', ''];
  for (const m of masters) {
    parts.push(buildMasterInline(m.value, true));
    parts.push('');
  }
  if (depth >= DEPTH_LEVEL.STANDARD && chart.lifeCycles?.activeCycle) {
    parts.push(
      `Aktif yaşam döngün (${chart.lifeCycles.activeCycle.name}) ${chart.lifeCycles.activeCycle.governingDisplay} ile yönetiliyor; usta frekans bu dönemin temasıyla birlikte çalışır.`,
    );
  }
  return parts.join('\n').trim();
}

function buildMasterInline(master, verbose = false) {
  const analysis = getMasterAnalysis(master);
  if (!analysis) return `Usta sayı ${master}.`;
  const lines = [
    `${analysis.display}: usta frekans — ${analysis.masterFrequency}`,
    `İndirgenmiş ${analysis.reduced}: ${analysis.reducedFrequency}`,
    `Aktif yaşanma: ${analysis.activeMode}. Pasif yaşanma: ${analysis.passiveMode}.`,
    `Sinir sistemi: ${analysis.nervousSystem}`,
    `İlham ↔ gerçeklik: ${analysis.inspirationVsReality}`,
  ];
  if (verbose) {
    lines.push(`Olgunlaşma: ${analysis.maturationAgeHint}`);
    lines.push(`Yaşanıp yaşanmadığını gösteren izler: ${analysis.livedIndicators.join('; ')}.`);
    lines.push(`Gölge: ${analysis.shadow.join(', ')}.`);
    lines.push(`Gelişim: ${getNumberProfile(master)?.development || ''}`);
  }
  return lines.filter(Boolean).join('\n');
}

function buildCyclesFocusReply(chart) {
  return [
    'Yaşam döngüsü yalnızca bir etiket değil; yaş aralığı, yöneten sayı ve ders setidir.',
    '',
    formatCyclesBlock(chart, true),
  ].join('\n');
}

function buildPeriodFocusReply(chart) {
  return formatPeriodBlock(chart, true);
}

function buildKarmicFocusReply(chart, askedPastLife, depth) {
  const parts = [];
  if (askedPastLife) {
    parts.push(
      'Numeroloji geçmiş yaşamı bilimsel olarak doğrulamaz; bu konu sembolik ve spiritüel bir yorum alanıdır. ' +
        '“Geçmiş yaşam kanıtı” yerine karmik tema, tekrarlayan ruhsal motif ve taşınan ders dilini kullanırım. ' +
        'Kesin kimlik, meslek, ülke veya tarih uydurmam.',
    );
    parts.push('');
  }
  parts.push(formatKarmicBrief(chart, true));
  if (depth >= DEPTH_LEVEL.STANDARD && chart.missingVibrations?.length) {
    parts.push(
      `Eksik titreşimler (${chart.missingVibrations.join(', ')}) bazı ekollerde “henüz güçlendirilecek ders alanı” olarak okunur — yine sembolik çerçeve.`,
    );
  }
  if (chart.repeatingMotifs?.length) {
    parts.push(
      `Tekrarlayan motifler: ${chart.repeatingMotifs.map((m) => m.value).join(', ')} — önceki deneyimlerden taşındığı varsayılan sembolik dersler olarak yorumlanabilir.`,
    );
  }
  return parts.join('\n');
}

function buildExploreReply(chart, nameChart, contradictions, covered) {
  const parts = ['Mevcut veriden henüz açılmamış veya az değinilmiş katmanlar:', ''];
  const candidates = [];

  if (!covered.has('pinnacles') && chart.pinnacles?.length) {
    const active = chart.pinnacles.find((p) => p.index === chart.activePinnacleIndex);
    candidates.push(
      active
        ? `Aktif zirve ${active.index}: ${active.display} (${ageRange(active.ageFrom, active.ageTo)}).`
        : `Zirve dönemlerin: ${chart.pinnacles.map((p) => `${p.index}=${p.display}`).join(', ')}.`,
    );
  }
  if (!covered.has('challenges') && chart.challenges?.length) {
    candidates.push(
      `Mücadele sayıları: ${chart.challenges.map((c) => `${c.index}=${c.display}`).join(', ')}.`,
    );
  }
  if (!covered.has('missing') && chart.missingVibrations?.length) {
    candidates.push(`Eksik titreşimler: ${chart.missingVibrations.join(', ')}.`);
  }
  if (!covered.has('contradictions') && contradictions?.tensions?.length) {
    candidates.push(contradictions.tensions[0].reading);
  }
  if (!covered.has('cycles')) {
    candidates.push(formatCyclesBlock(chart));
  }
  if (!nameChart?.ok) {
    candidates.push(
      'Ad soyad yok; İfade / Ruh Arzusu / Kişilik katmanları henüz kapalı. İstersen isimle açarız — tahmin etmem.',
    );
  }

  if (!candidates.length) {
    parts.push(
      'Doğum tarihi katmanlarının çoğu açık. Daha ileri için ad soyad veya belirli bir katman (zirve, mücadele, usta sayı) söylemen yeterli.',
    );
  } else {
    for (const c of candidates.slice(0, 5)) parts.push(`• ${c}`);
  }
  return parts.join('\n');
}

function formatCyclesBlock(chart, verbose = false) {
  const lines = [];
  for (const c of chart.lifeCycles?.cycles || []) {
    const prof = getNumberProfile(c.governingNumber);
    const active = chart.lifeCycles.activeCycleIndex === c.index ? ' ← şu an buradasın' : '';
    lines.push(
      `• ${c.name} (${ageRange(c.ageFrom, c.ageTo)}): sayı ${c.governingDisplay}` +
        (prof ? ` — ${prof.label}` : '') +
        active,
    );
    if (verbose && prof) {
      lines.push(`  Tema: ${prof.core}`);
      lines.push(`  Ders: ${prof.lifeLesson}`);
      lines.push(`  Güçlü: ${prof.strengths.slice(0, 3).join(', ')}; zorlanma: ${prof.shadows.slice(0, 3).join(', ')}`);
      lines.push(`  İlişki: ${prof.relationships}`);
      lines.push(`  İş/üretim: ${prof.career}`);
    }
  }
  const cycles = chart.lifeCycles?.cycles || [];
  if (verbose && chart.lifeCycles?.activeCycleIndex) {
    const idx = chart.lifeCycles.activeCycleIndex;
    const next = cycles.find((c) => c.index === idx + 1);
    if (next) {
      const np = getNumberProfile(next.governingNumber);
      lines.push(
        `Sonraki döngüye geçiş: ${next.name} (${next.governingDisplay})` +
          (np ? ` — ${np.core}` : ''),
      );
    }
  }
  return lines.join('\n');
}

function formatPeriodBlock(chart, verbose = false) {
  const py = chart.personalYear;
  const lines = [];
  if (py) {
    lines.push(
      `Kişisel yıl ${py.calendarYear}: ${py.display} (${py.formula}` +
        (py.steps.length ? ` → ${py.steps.join(' → ')}` : '') +
        ').',
    );
    lines.push(getPersonalYearTheme(py.value));
  }
  if (chart.lifeCycles?.activeCycle) {
    const c = chart.lifeCycles.activeCycle;
    lines.push(
      `Aktif yaşam döngüsü: ${c.name} (${ageRange(c.ageFrom, c.ageTo)}), yöneten ${c.governingDisplay}.`,
    );
  }
  if (chart.activePinnacleIndex) {
    const p = chart.pinnacles.find((x) => x.index === chart.activePinnacleIndex);
    if (p) {
      lines.push(`Aktif zirve: ${p.index} → ${p.display} (${ageRange(p.ageFrom, p.ageTo)}).`);
    }
  }
  if (verbose && chart.age != null) {
    lines.push(`Hesaplanan yaş: ${chart.age}.`);
  }
  return lines.join('\n');
}

function formatKarmicBrief(chart, verbose = false) {
  const lines = [
    'Numeroloji geçmiş yaşamı doğrulamaz; bazı ekollerde karmik borç sayıları, eksik titreşimler ve tekrarlayan motifler sembolik ders olarak okunur.',
  ];
  if (chart.karmicDebts?.length) {
    for (const d of chart.karmicDebts) {
      const note = getKarmicDebtNote(d);
      lines.push(note ? `• ${d}: ${note.theme}. ${verbose ? note.note : ''}`.trim() : `• ${d}`);
    }
  } else {
    lines.push('Bu profilde klasik karmik borç ara toplamı (13/14/16/19) belirgin görünmüyor.');
  }
  return lines.join('\n');
}

function formatDateTr(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
