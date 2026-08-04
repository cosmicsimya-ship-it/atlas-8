/**
 * Atlas Dream Interpretation methodology identity.
 * Multi-layer symbolic reading — never prophecy or diagnosis.
 */

export const ATLAS_DREAM_METHODOLOGY = Object.freeze({
  methodologyId: 'atlas-dream-v1',
  methodologyVersion: '1.0.0',
  rulesetVersion: 'atlas-dream-rules-1.0.0',
  displayName: 'Atlas Rüya Sembol Yorumu',
  category: 'dream-interpretation',
  school:
    'Multi-layer symbolic dream reading (symbol · emotion · narrative · Jung · classical · psychological · personal context)',
  disclaimer:
    'Rüya analizi sembolik ve olasılıksaldır; kesin kehanet, hastalık teşhisi veya kader iddiası taşımaz. ' +
    'Tek sembolden hüküm verilmez; duygu, olay örgüsü ve bağlam birlikte değerlendirilir. ' +
    'Bu yorum kesin değildir.',
  disputedAreas: Object.freeze([
    'Klasik İslamî rüya yorumları ekol ve kaynaklara göre değişir; Atlas yalnızca olası sembolik anlamlar sunar.',
    'Jung arketipleri zorla ilişkilendirilmez; yalnızca uyum güçlüyse önerilir.',
    'Kişisel bellek bağlantısı yalnızca kanıtlanabilir temas varsa kurulur; uydurma ilişki üretilmez.',
  ]),
  limitations: Object.freeze([
    'Gelecek kesinliği, ölüm tarihi veya hastalık teşhisi üretilmez.',
    'Tek sembol sözlüğü sıralaması yerine katmanlı sentez önceliklidir.',
    'Kullanıcı rüyayı anlatmadan tam analiz yapılmaz; önce bilgilendirici sorular sorulur.',
  ]),
});

export const DREAM_ENGINE_VERSION = 'atlas-dream-engine-v1';

/** Depth levels — default is standard (2). */
export const DEPTH_LEVEL = Object.freeze({
  SHORT: 1,
  STANDARD: 2,
  DEEP: 3,
});
