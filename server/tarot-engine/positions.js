/**
 * Spread position layouts by question / intention type.
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   role: string,
 * }} SpreadPosition
 */

/**
 * @typedef {'general'|'emotions'|'relationship'|'field'|'decision'|'action'|'custom'} SpreadKind
 */

/** @type {Record<SpreadKind, SpreadPosition[]>} */
export const SPREAD_LAYOUTS = Object.freeze({
  general: Object.freeze([
    Object.freeze({ id: 'visible', label: 'Görünen enerji', role: 'surface' }),
    Object.freeze({ id: 'hidden', label: 'Görünmeyen dinamik', role: 'hidden' }),
    Object.freeze({ id: 'direction', label: 'Temanın yönü', role: 'outcome' }),
  ]),
  emotions: Object.freeze([
    Object.freeze({ id: 'surface', label: 'Yüzeydeki duygu', role: 'surface' }),
    Object.freeze({ id: 'suppressed', label: 'Bastırılan veya gizli duygu', role: 'hidden' }),
    Object.freeze({ id: 'behavior', label: 'Duygunun davranışa dönüşümü', role: 'outcome' }),
  ]),
  relationship: Object.freeze([
    Object.freeze({ id: 'self', label: 'Kullanıcının alanı', role: 'self' }),
    Object.freeze({ id: 'other', label: 'Diğer kişinin alanı', role: 'other' }),
    Object.freeze({ id: 'bond', label: 'Aradaki ortak örüntü', role: 'bond' }),
  ]),
  field: Object.freeze([
    Object.freeze({ id: 'dominant', label: 'Alanın baskın enerjisi', role: 'surface' }),
    Object.freeze({ id: 'behind', label: 'Perde arkasındaki etken', role: 'hidden' }),
    Object.freeze({ id: 'forming', label: 'Şekillenmekte olan tema', role: 'outcome' }),
  ]),
  decision: Object.freeze([
    Object.freeze({ id: 'tendency', label: 'Mevcut eğilim', role: 'surface' }),
    Object.freeze({ id: 'blind', label: 'Kör nokta', role: 'hidden' }),
    Object.freeze({ id: 'consider', label: 'Dikkate alınması gereken yön', role: 'outcome' }),
  ]),
  action: Object.freeze([
    Object.freeze({ id: 'impulse', label: 'Harekete iten', role: 'surface' }),
    Object.freeze({ id: 'block', label: 'Hareketi tutan', role: 'hidden' }),
    Object.freeze({ id: 'next', label: 'Olası sonraki adım', role: 'outcome' }),
  ]),
  custom: Object.freeze([
    Object.freeze({ id: 'p1', label: 'Birinci katman', role: 'surface' }),
    Object.freeze({ id: 'p2', label: 'İkinci katman', role: 'hidden' }),
    Object.freeze({ id: 'p3', label: 'Üçüncü katman', role: 'outcome' }),
  ]),
});

/**
 * Infer spread kind from user intention / message.
 * @param {string} message
 * @param {string|null} [intentTopic]
 * @returns {SpreadKind}
 */
export function resolveSpreadKind(message, intentTopic = null) {
  const t = `${message || ''} ${intentTopic || ''}`.toLocaleLowerCase('tr-TR');

  if (/eylem|davran|ne\s+yap|adım|hareket/i.test(t)) return 'action';
  if (/duygu|his|kalp|i[cç]inden/i.test(t)) return 'emotions';
  if (/ili[sş]ki|biz|aradaki|ba[gğ]|partner|sevgili|e[sş]/i.test(t)) return 'relationship';
  if (/alan|ortam|enerji\s+alan|perde\s+arka/i.test(t)) return 'field';
  if (/karar|se[cç]im|ne\s+yapmal[ıi]|ikilem/i.test(t)) return 'decision';
  if (/g[oö]r[uü]nmeyen\s+niyet|niyet/i.test(t)) return 'field';
  return 'general';
}

/**
 * @param {SpreadKind} kind
 * @param {number} [count]
 * @returns {SpreadPosition[]}
 */
export function getPositionsForSpread(kind, count = 3) {
  const layout = SPREAD_LAYOUTS[kind] || SPREAD_LAYOUTS.general;
  if (count <= layout.length) return layout.slice(0, count);
  const extra = [];
  for (let i = layout.length; i < count; i++) {
    extra.push({
      id: `extra-${i + 1}`,
      label: `${i + 1}. katman`,
      role: 'extra',
    });
  }
  return [...layout, ...extra];
}

/**
 * Human label for spread kind.
 * @param {SpreadKind} kind
 */
export function spreadKindLabel(kind) {
  switch (kind) {
    case 'emotions':
      return 'Duygu açılımı (3 kart)';
    case 'relationship':
      return 'İlişki dinamiği (3 kart)';
    case 'field':
      return 'Alan / görünmeyen dinamik (3 kart)';
    case 'decision':
      return 'Karar açılımı (3 kart)';
    case 'action':
      return 'Eylem açılımı (3 kart)';
    case 'custom':
      return 'Özel düzen';
    default:
      return 'Genel üç kart açılımı';
  }
}
