/**
 * Personal context layer — only evidenced links from user memory / recent talk.
 * Never invent relationships.
 */

import { getUserMemory, isValidUserId } from '../user-memory.js';

/** Soft keyword → life-theme map for evidenced matching only. */
const FACT_THEME_HINTS = Object.freeze([
  {
    keys: [/taşın|taşınma|yeni\s+ev|kira|ev\s+değiş/i],
    symbolIds: ['house', 'door', 'key', 'stairs', 'bridge'],
    label: 'taşınma / mekân değişimi',
  },
  {
    keys: [/iş\s+değiş|işten\s+ayr|yeni\s+iş|kariyer|işsiz/i],
    symbolIds: ['stairs', 'car', 'train', 'plane', 'bridge', 'door'],
    label: 'iş / yön değişimi',
  },
  {
    keys: [/ayrılık|boşan|ilişki|sevgili|eş[im]?|evlilik/i],
    symbolIds: ['wedding', 'mirror', 'door', 'key', 'heart'],
    label: 'ilişki / bağ',
  },
  {
    keys: [/yas|kayıp|vefat|ölüm|cenaze|matem/i],
    symbolIds: ['death', 'black', 'rain', 'water'],
    label: 'yas / kayıp',
  },
  {
    keys: [/hamile|bebek|çocuk|doğum/i],
    symbolIds: ['baby', 'child', 'house'],
    label: 'ebeveynlik / yeni başlangıç',
  },
  {
    keys: [/sınav|okul|üniversite|ders/i],
    symbolIds: ['stairs', 'chase', 'rush', 'key'],
    label: 'sınav / değerlendirme baskısı',
  },
  {
    keys: [/hasta|tedavi|doktor|sağlık/i],
    symbolIds: ['water', 'fire', 'death', 'snake'],
    label: 'sağlık kaygısı (teşhis değil)',
  },
  {
    keys: [/para|borç|maaş|ekonom/i],
    symbolIds: ['money', 'gold', 'key'],
    label: 'maddi güvenlik',
  },
]);

/**
 * Collect searchable text blobs from memory + recent history.
 * @param {{
 *   userId?: string|null,
 *   history?: { role: string, content: string }[],
 *   memoryFacts?: Record<string, unknown>|null,
 * }} input
 */
export function collectPersonalEvidence(input) {
  /** @type {string[]} */
  const blobs = [];

  if (input.memoryFacts && typeof input.memoryFacts === 'object') {
    for (const [k, v] of Object.entries(input.memoryFacts)) {
      if (v == null) continue;
      blobs.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
  }

  if (input.userId && isValidUserId(input.userId)) {
    try {
      const mem = getUserMemory(input.userId);
      if (mem.facts) {
        for (const [k, v] of Object.entries(mem.facts)) {
          if (v == null) continue;
          blobs.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
        }
      }
      if (mem.profile) {
        for (const [k, v] of Object.entries(mem.profile)) {
          if (typeof v === 'string' && v.trim()) blobs.push(`profile.${k}: ${v}`);
        }
      }
    } catch {
      // invalid / missing memory — no personal layer
    }
  }

  const history = input.history || [];
  // Only recent user turns — avoid inventing from assistant speculation
  for (const turn of history.slice(-12)) {
    if (turn?.role === 'user' && turn.content) {
      blobs.push(String(turn.content));
    }
  }

  return blobs.join('\n');
}

/**
 * @param {{
 *   symbols: { id: string, name: string }[],
 *   userId?: string|null,
 *   history?: { role: string, content: string }[],
 *   memoryFacts?: Record<string, unknown>|null,
 * }} input
 * @returns {{
 *   links: { symbolId: string, symbolName: string, theme: string, evidence: string, reading: string }[],
 *   note: string,
 * }}
 */
export function resolvePersonalContext(input) {
  const evidenceText = collectPersonalEvidence(input);
  if (!evidenceText.trim()) {
    return {
      links: [],
      note: 'Kişisel bellek bağlantısı kurulamadı; uydurma ilişki üretilmedi.',
    };
  }

  const symbolIds = new Set((input.symbols || []).map((s) => s.id));
  /** @type {{ symbolId: string, symbolName: string, theme: string, evidence: string, reading: string }[]} */
  const links = [];

  for (const hint of FACT_THEME_HINTS) {
    const matchedKey = hint.keys.find((re) => re.test(evidenceText));
    if (!matchedKey) continue;

    const overlap = hint.symbolIds.filter((id) => symbolIds.has(id));
    if (!overlap.length) continue;

    // Extract a short evidence snippet (first matching line)
    const evidence = snipEvidence(evidenceText, matchedKey);
    if (!evidence) continue;

    for (const sid of overlap.slice(0, 2)) {
      const sym = (input.symbols || []).find((s) => s.id === sid);
      links.push({
        symbolId: sid,
        symbolName: sym?.name || sid,
        theme: hint.label,
        evidence,
        reading:
          `«${sym?.name || sid}» sembolü, bellek/konuşmada geçen «${hint.label}» ile ilişkilendirilebilir. ` +
          `Bu bağlantı spekülasyon değil, senin paylaştığın bağlama dayanır — yine de kesin hüküm değildir.`,
      });
    }
  }

  // Deduplicate by symbolId+theme
  const seen = new Set();
  const unique = links.filter((l) => {
    const k = `${l.symbolId}::${l.theme}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    links: unique.slice(0, 4),
    note: unique.length
      ? 'Kişisel bağlam yalnızca kanıtlanabilir temaslarla eklendi.'
      : 'Rüya sembolleri ile bellek arasında güvenilir örtüşme bulunamadı; ilişki uydurulmadı.',
  };
}

/**
 * @param {string} text
 * @param {RegExp} re
 */
function snipEvidence(text, re) {
  const lines = String(text).split(/\n+/);
  for (const line of lines) {
    if (re.test(line)) {
      const cleaned = line.replace(/\s+/g, ' ').trim();
      return cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned;
    }
  }
  const m = String(text).match(re);
  return m ? m[0] : '';
}
