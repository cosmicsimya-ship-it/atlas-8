/**
 * Final safety filter for symbolic analysis user-facing prose.
 * Softens certainty / divine decree / medical-treatment language.
 */

const FORBIDDEN = [
  { id: 'kesin_gelecek', re: /\bkesin(likle)?\s+(olacak|gelecek|kader)\b/i },
  { id: 'kesinlikle', re: /\bkesinlikle\b/i },
  // Affirmative only — allow disclaimers like "ilahi hüküm değildir"
  { id: 'ilahi_hukum', re: /\bilahi\s+hüküm(?!\s+değil)/i },
  { id: 'allah_emrediyor', re: /\ballah\s+emrediyor/i },
  { id: 'fetva', re: /\bfetva\s+ver/i },
  { id: 'kader_iddiasi', re: /\bkaderindir\b|\bkaderin\s+bu\b|\bkaçınılmaz\s+kader\b/i },
  { id: 'tibbi', re: /\btedavi\s+(eder|olur|sağlar)|psikiyatrik\s+tedavi|tıbbi\s+reçete|iyileştirir|böbreği\s+düzelt|kreatinini\s+düşür/i },
  { id: 'korku', re: /\bmutlaka\s+ceza\b|\blanet(lenecek)?\b|\bhelak\s+olacaksın\b/i },
  { id: 'gercek_iddia', re: /\bkesin\s+gerçek\b|\btek\s+doğru\s+yorum\b/i },
];

/**
 * @param {string} text
 * @returns {{ ok: boolean, hits: Array<{id:string,match:string}>, cleaned: string }}
 */
export function scanSymbolicCertainty(text) {
  const source = typeof text === 'string' ? text : '';
  const hits = [];
  for (const rule of FORBIDDEN) {
    const m = source.match(rule.re);
    if (m) hits.push({ id: rule.id, match: m[0] });
  }
  return { ok: hits.length === 0, hits, cleaned: source };
}

/**
 * @param {string} text
 * @returns {{ text: string, rejected: boolean, hits: Array<{id:string,match:string}> }}
 */
export function sanitizeSymbolicProse(text) {
  const scan = scanSymbolicCertainty(text);
  if (scan.ok) return { text: scan.cleaned, rejected: false, hits: [] };

  let out = scan.cleaned;
  out = out.replace(/\bkesinlikle\b/gi, 'sembolik olarak');
  out = out.replace(/\bkesin(likle)?\s+(olacak|gelecek|kader)\b/gi, 'olası bir düşünme alanı');
  out = out.replace(/\bilahi\s+hüküm/gi, 'kişisel bir yorum çerçevesi');
  out = out.replace(/\ballah\s+emrediyor/gi, 'bu yöntem içinde bir motif olarak okunabilir');
  out = out.replace(/\bfetva\s+ver\w*/gi, 'hüküm vermez');
  out = out.replace(/\bkaderindir\b|\bkaderin\s+bu\b/gi, 'kesin kader iddiası değildir');
  out = out.replace(/\bkaçınılmaz\s+kader\b/gi, 'zorunlu bir kader değildir');
  out = out.replace(/\btedavi\s+(eder|olur|sağlar)/gi, 'düşünme alanı açabilir');
  out = out.replace(/\biyileştirir\b/gi, 'manevi destek olarak okunabilir');
  out = out.replace(/\bböbreği\s+düzelt\w*/gi, 'tıbbi düzelme iddiası taşımaz');
  out = out.replace(/\bkreatinini\s+düşür\w*/gi, 'lab değeri iddiası taşımaz');
  out = out.replace(/\bpsikiyatrik\s+tedavi/gi, 'profesyonel destek');
  out = out.replace(/\btıbbi\s+reçete/gi, 'tıbbi öneri değildir');
  out = out.replace(/\bmutlaka\s+ceza\b/gi, 'zorunlu bir sonuç değildir');
  out = out.replace(/\blanet(lenecek)?\b/gi, 'yargılayıcı dil kullanılmaz');
  out = out.replace(/\bhelak\s+olacaksın\b/gi, 'korkutucu dil kullanılmaz');
  out = out.replace(/\bkesin\s+gerçek\b/gi, 'eldeki verilerle bir okuma');
  out = out.replace(/\btek\s+doğru\s+yorum\b/gi, 'olası bir yorum');

  const rescan = scanSymbolicCertainty(out);
  if (!rescan.ok) {
    return {
      text:
        'Bu ifade kesin hüküm, korku veya tedavi dili içerdiği için sadeleştirildi. Atlas sembolik bir düşünme alanı açar; kesin kader veya ilahi hüküm iddiası taşımaz.',
      rejected: true,
      hits: scan.hits,
    };
  }
  return { text: out, rejected: false, hits: scan.hits };
}

/**
 * Apply safety pass to all section bodies.
 * @param {Array<{ id: string, title: string, body: string }>} sections
 */
export function filterUserSections(sections) {
  return (Array.isArray(sections) ? sections : []).map((s) => {
    const safe = sanitizeSymbolicProse(s.body || '');
    return { ...s, body: safe.text };
  });
}
