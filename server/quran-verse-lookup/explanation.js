/**
 * Quran explanation boundary.
 * Verse text and meal remain source data; this module only prepares a grounded
 * request for a model-generated explanation and rejects unsafe model output.
 */

const EXPLANATION_REQUEST = /\b(a[cç][ıi]kla|yorumla|ne\s+demek|ne\s+anlat[ıi]yor)\b/i;

export function wantsQuranExplanation(message) {
  return EXPLANATION_REQUEST.test(String(message ?? ''));
}

export function buildGroundedQuranExplanationPrompt(verse) {
  return {
    systemPrompt: `Sen Kur'an ayeti için kısa, sade Türkçe açıklama yazıyorsun.\n\nKESİN SINIRLAR:\n- Aşağıdaki ayet metni ve meal doğrulanmış kaynak verisidir; değiştirme, yeniden yazma veya alıntılama.\n- Yalnızca bu veriye dayan; kendi hafızandan ayet, meal, referans, tarihsel bağlam veya tefsir ayrıntısı ekleme.\n- "Ayet şöyle diyor" diye doğrulanmış veride bulunmayan sözler atfetme.\n- 2-4 cümlelik açıklama üret; ayet metni, Arapça, meal başlığı veya kaynak adı üretme.\n- Bu içerik tefsir değil, açıklamadır.`,
    userPrompt: `Doğrulanmış referans: ${verse.surah_name} ${verse.surah_number}:${verse.ayah_number}\nDoğrulanmış meal: ${verse.translation}\n\nBu doğrulanmış mealin ana mesajını sade Türkçeyle açıkla.`,
  };
}

/** Reject outputs that try to reproduce source text instead of explaining it. */
export function sanitizeGroundedQuranExplanation(content, verse) {
  const text = String(content ?? '').trim();
  if (!text || text.length > 1400) return null;
  if (/\p{Script=Arabic}/u.test(text)) return null;
  if (/^(?:arapça|meal|kaynak|ayet metni)\s*:/im.test(text)) return null;
  if (verse?.translation && text.includes(String(verse.translation).trim())) return null;
  return text;
}

/** Resolve only explicit previous assistant references for “Bu ayeti açıklar mısın?”. */
export function resolveContextualQuranReference(message, history = []) {
  if (!wantsQuranExplanation(message)) return null;
  for (const turn of [...history].reverse()) {
    if (turn?.role !== 'assistant') continue;
    const body = String(turn?.content ?? turn?.text ?? turn?.message ?? '');
    const match = body.match(/\b(\d{1,3}):(\d{1,3})\b/);
    if (match && /doğrulanmış kaynak/i.test(body)) return `${match[1]}:${match[2]}`;
  }
  return null;
}
