/**
 * Certainty / authority language filter for synthesis prose.
 * Blocks forced validation claims between Quran and symbolic layers.
 */

/** Affirmative verification only — negations like "doğrulanmış sayılmaz" must not match. */
const FORBIDDEN_PATTERNS = [
  { id: 'kesinlikle', re: /\bkesinlikle\b/i },
  { id: 'kanitliyor', re: /\bkanıtlıyor\b|\bkanitliyor\b|\bkanıtlar\b|\bkanitlar\b/i },
  { id: 'dogruluyor', re: /\bdoğruluyor\b|\bdogruluyor\b|\bdoğruladı\b|\bdogruladi\b/i },
  { id: 'teyit', re: /\bteyit ediyor\b|\bteyitledi\b/i },
  { id: 'allah_bugun', re: /allah\s+bugün\s+sana/i },
  { id: 'gokyuzu_ayet', re: /gökyüzü\s+bu\s+ayeti\s+(doğrul|dogrul|teyit|kanıt|kanit)|gokyuzu\s+bu\s+ayeti\s+(doğrul|dogrul|teyit|kanıt|kanit)/i },
  {
    id: 'astro_quran_confirm',
    re: /(astroloji|numeroloji|gökyüzü|gokyuzu).{0,60}(âyet|ayet|kur[’']?an).{0,40}(doğruluyor|dogruluyor|doğruladı|teyit ediyor|kanıtlıyor|kanitliyor)/i,
  },
  {
    id: 'quran_astro_confirm',
    re: /(âyet|ayet|kur[’']?an).{0,60}(astroloji|numeroloji|gökyüzü|gokyuzu).{0,40}(doğruluyor|dogruluyor|doğruladı|teyit ediyor|kanıtlıyor|kanitliyor)/i,
  },
  { id: 'ilahi_mesaj_bugun', re: /bugün\s+için\s+ilahi\s+mesaj|ilah[iî]\s+irade\s+kesin/i },
  { id: 'fetva', re: /\bfetva\s+(veriyorum|veririm|verilir|vermek)\b/i },
];

/**
 * @param {string} text
 * @returns {{ ok: boolean, hits: Array<{id:string,match:string}>, cleaned: string }}
 */
export function scanCertaintyLanguage(text) {
  const source = typeof text === 'string' ? text : '';
  const hits = [];
  for (const rule of FORBIDDEN_PATTERNS) {
    const m = source.match(rule.re);
    if (m) hits.push({ id: rule.id, match: m[0] });
  }
  return { ok: hits.length === 0, hits, cleaned: source };
}

/**
 * Soft-sanitize: replace forbidden certainty claims with safer phrasing markers.
 * Does not invent theological content.
 * @param {string} text
 * @returns {{ text: string, rejected: boolean, hits: Array<{id:string,match:string}> }}
 */
export function sanitizeCertaintyLanguage(text) {
  const scan = scanCertaintyLanguage(text);
  if (scan.ok) {
    return { text: scan.cleaned, rejected: false, hits: [] };
  }

  let out = scan.cleaned;
  out = out.replace(/\bkesinlikle\b/gi, 'olası olarak');
  out = out.replace(/\bkanıtlıyor\b|\bkanitliyor\b/gi, 'benzer bir düşünme alanına işaret ediyor');
  out = out.replace(/\bdoğruluyor\b|\bdogruluyor\b/gi, 'aynı yönde düşünmeye davet ediyor');
  out = out.replace(/\bteyit ediyor\b/gi, 'karşılaştırmalı okumaya açık bırakıyor');
  out = out.replace(/allah\s+bugün\s+sana[^.!?]*/gi, 'bu referans kişisel bir düşünme alanı açabilir');
  out = out.replace(/gökyüzü\s+bu\s+ayeti\s+\S+/gi, 'gökyüzü verisi ile ayet referansı ayrı yöntemlerdir');
  out = out.replace(/gokyuzu\s+bu\s+ayeti\s+\S+/gi, 'gokyuzu verisi ile ayet referansı ayrı yöntemlerdir');

  const rescan = scanCertaintyLanguage(out);
  if (!rescan.ok) {
    return {
      text:
        'Bu ifade kesin doğrulama veya ilahi hüküm dili içerdiği için reddedildi. Katmanlar ayrı yöntemlerle okunmalı; biri diğerini doğrulamaz.',
      rejected: true,
      hits: scan.hits,
    };
  }
  return { text: out, rejected: false, hits: scan.hits };
}

/**
 * Reject draft synthesis claims that assert cross-domain validation.
 * @param {string} claim
 * @returns {{ accepted: boolean, reason: string|null, safeText: string|null }}
 */
export function evaluateSynthesisClaim(claim) {
  const scan = scanCertaintyLanguage(claim);
  if (!scan.ok) {
    const ids = scan.hits.map((h) => h.id);
    if (ids.some((id) => id.includes('confirm') || id.includes('gokyuzu') || id.includes('allah'))) {
      return {
        accepted: false,
        reason: 'Cross-domain validation or divine-certainty language is not allowed.',
        safeText: null,
      };
    }
    const sanitized = sanitizeCertaintyLanguage(claim);
    if (sanitized.rejected) {
      return { accepted: false, reason: 'Unrecoverable certainty language.', safeText: null };
    }
    return { accepted: true, reason: 'Soft-sanitized certainty language.', safeText: sanitized.text };
  }
  return { accepted: true, reason: null, safeText: claim };
}
