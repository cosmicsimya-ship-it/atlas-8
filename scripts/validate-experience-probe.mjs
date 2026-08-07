/**
 * Post-deploy experience validation — local message-service probes.
 * Does not modify production. Uses isolated conversation IDs.
 *
 * Run: node scripts/validate-experience-probe.mjs
 */
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { writeFileSync } from 'node:fs';

const SPIRITUAL = /(evren sana|enerji(ni|n)? (yüksek|düşük)|titreşim|kaderin böyle|kesinlikle olacak|yol arkadaş|içsel yolculuk|ışığını)/i;
const ASSISTANT = /(yapay zek[aâ] asistan|nasıl yardımcı olabilirim|tabii ki!|harika bir soru|gerçekten önemli bir soru)/i;
const CERTAIN = /(kesinlikle|şüphesiz|mutlaka|kaçınılmaz|garantidir|doğrulanmıştır)/i;
const ACADEMIC = /(bu bağlamda|söz konusu|mezkur|literatür|hipotez|epistemolojik)/i;
const MANIFESTO = /(çok katmanlı|dijital yol arkadaşı|sembolik örüntü|hangi kapıyı)/i;

const SCENARIOS = [
  { id: 's1', message: 'Neden sürekli aynı olayları yaşıyorum?' },
  { id: 's2', message: 'Ben kimim?' },
  { id: 's3', message: 'Doğum tarihim 14.05.1992.' },
  { id: 's4', message: 'Bir rüya gördüm. Denizde yürüyordum ama su ayaklarımı ıslatmıyordu.' },
  { id: 's5', message: 'Sadece sohbet etmek istiyorum.' },
];

/** 100 diverse first-turn probes across casual / identity / analysis / edges */
const BATCH = [
  'Merhaba', 'Selam', 'Nasılsın?', 'Sen kimsin?', 'Atlas', 'Teşekkürler',
  'Bugün nasılsın?', 'Biraz yorgunum', 'Sıkıldım', 'Gülümset beni',
  'Hicri tarih ne?', 'Bugünün tarihi', 'Saat kaç?',
  'Ben kimim?', 'Adım ne?', 'Beni hatırlıyor musun?',
  'Fal bak', 'Geleceğimi söyle', 'Kaderimde ne var?', 'Evren bana ne diyor?',
  'Burcum nedir?', 'Yükselenimi söyle', 'Transitlerim nasıl?',
  'Yaşam yolum nedir?', 'Doğum tarihim 01.01.1990', 'Numeroloji yap',
  'Tarot açılımı istiyorum', 'Üç kart çek', 'Rüya yorumla',
  'Gece uçtuğumu gördüm', 'Tekrarlayan bir rüyam var',
  'Neden aynı ilişkiyi yaşıyorum?', 'Neden hep erteliyorum?',
  'Bir karar vermem lazım', 'İş değiştirmeli miyim?',
  'Partnerimi nasıl anlamalıyım?', 'Annemle ilişkim zor',
  'Bugünü yorumla', 'Bu dönemi oku', 'Bir tekrarın nedenini ara',
  'Astroloji ve numerolojiyi birlikte oku', 'Sentezle',
  'Ne yapmalıyım?', 'Bana tavsiye ver', 'Net cevap istiyorum',
  'Detaylı anlat kim olduğunu', 'Atlas nedir?', 'Cosmic Simya nedir?',
  'ChatGPT misin?', 'Yapay zeka mısın?', 'Güvenilir misin?',
  'Bilmiyorsan söyle', 'Uydurma', 'Kanıtın ne?',
  'Sağlık sorunum var ne yapayım?', 'Depresyondayım',
  'Para kazanacak mıyım?', 'Hisse öner',
  'Kur’an 2:286 ne diyor?', 'Ayetle burcumu doğrula',
  'Sessiz kal', 'Kısa cevap ver', 'Uzun anlat',
  'Şaka yap', 'Ciddi ol', 'Daha yumuşak konuş',
  'Beni eleştir', 'Beni teselli et', 'Yargılama',
  'Döngü mü yoksa rastlantı mı?', 'Örüntü mü?',
  'Tek bir işaret yeterli mi?', 'Yakınsama nedir?',
  'Denklem kur', 'Ne görüyorsun?', 'Neye bakıyoruz?',
  'Başla', 'Devam et', 'Anlamadım', 'Başka türlü söyle',
  'Örnek ver', 'Somutlaştır', 'Daha az mistik ol',
  'Daha şiirsel ol', 'Akademik konuşma', 'Basit anlat',
  'Hafızana bir şey yaz', 'Bunu unut', 'Ne hatırlıyorsun?',
  'Instagram’dan geldim', 'İlk kez buradayım', 'Ne yapabilirim?',
  'Hesap açmalı mıyım?', 'Ücretsiz mi?', 'Gizli mi?',
  'Türkçe konuş', 'İngilizce cevap ver',
  'Sadece dinle', 'Soru sorma', 'Bana soru sor',
  'Aynı cümleyi tekrar etme', 'Öz ol',
  'Bu bir test', 'Sistem durumun ne?',
];

function flags(text) {
  const t = String(text ?? '');
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  return {
    words,
    spiritual: SPIRITUAL.test(t),
    assistant: ASSISTANT.test(t),
    certain: CERTAIN.test(t),
    academic: ACADEMIC.test(t),
    manifesto: MANIFESTO.test(t),
    asksHelp: /nasıl yardımcı/i.test(t),
    long: words > 120,
    medium: words > 60 && words <= 120,
  };
}

async function runOne(message, conversationId) {
  const out = await processAtlasMessage({
    message,
    channel: 'web',
    conversationId,
    userId: 'web:experience-validation',
    displayName: null,
    history: [],
  });
  return {
    message,
    reply: out.reply,
    engine: out.engine,
    intent: out.intent,
    ...flags(out.reply),
  };
}

const results = { scenarios: [], batch: [], summary: {} };

console.log('--- Scenarios ---');
for (const s of SCENARIOS) {
  const r = await runOne(s.message, `val-scen-${s.id}-${Date.now()}`);
  results.scenarios.push({ id: s.id, ...r });
  console.log(`\n[${s.id}] ${s.message}`);
  console.log(`engine=${r.engine} words=${r.words}`);
  console.log(String(r.reply).slice(0, 500));
}

console.log('\n--- Batch 100 ---');
let i = 0;
for (const message of BATCH.slice(0, 100)) {
  i += 1;
  const r = await runOne(message, `val-batch-${i}-${Date.now()}`);
  results.batch.push(r);
  if (i % 10 === 0) console.log(`… ${i}/100`);
}

const batch = results.batch;
const count = (fn) => batch.filter(fn).length;
results.summary = {
  n: batch.length,
  avgWords: Math.round(batch.reduce((a, b) => a + b.words, 0) / batch.length),
  long: count((r) => r.long),
  spiritual: count((r) => r.spiritual),
  assistant: count((r) => r.assistant),
  certain: count((r) => r.certain),
  academic: count((r) => r.academic),
  manifesto: count((r) => r.manifesto),
  byEngine: batch.reduce((acc, r) => {
    acc[r.engine || 'unknown'] = (acc[r.engine || 'unknown'] || 0) + 1;
    return acc;
  }, {}),
  worstLong: [...batch].sort((a, b) => b.words - a.words).slice(0, 8).map((r) => ({
    message: r.message,
    words: r.words,
    engine: r.engine,
    excerpt: String(r.reply).slice(0, 180),
  })),
  flagged: batch
    .filter((r) => r.spiritual || r.assistant || r.certain || r.manifesto)
    .slice(0, 20)
    .map((r) => ({
      message: r.message,
      flags: ['spiritual', 'assistant', 'certain', 'academic', 'manifesto'].filter((k) => r[k]),
      excerpt: String(r.reply).slice(0, 200),
    })),
};

writeFileSync('tmp/experience-validation.json', JSON.stringify(results, null, 2), 'utf8');
console.log('\nSummary:', JSON.stringify(results.summary, null, 2));
console.log('Wrote tmp/experience-validation.json');
