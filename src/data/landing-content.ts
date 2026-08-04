export const landingHero = {
  brand: 'ATLAS',
  eyebrow: 'Cosmicsimya',
  titleLines: ['Her şey zaten ortada.', 'Mesele nasıl okuduğun.'],
  body:
    'Atlas sana ne düşüneceğini söylemez. Aynı gökyüzüne, aynı zamana ve aynı verilere başka bir yerden bakabilmen için katmanları yan yana getirir. Çünkü bazen değişmesi gereken gerçeklik değil, onu okuma biçimidir.',
  primaryCta: { label: 'Atlas’ı keşfet', to: '/atlas' },
  secondaryCta: { label: 'Örnek analizi gör', sectionId: 'ornek-analiz' },
} as const;

export const landingWhatIs = {
  id: 'atlas-nedir',
  titleLines: ['Tek bir cevap değil.', 'Birlikte okunan katmanlar.'],
  paragraphs: [
    'Atlas kesin hüküm vermez. Farklı veri ve sembolik sistemleri yan yana getirerek düşünme alanı açar.',
    'Her sistem kendi yönteminde kalır; ortak örüntü ancak bu sistemler birlikte okunduğunda görünür hale gelir.',
    'Amaç cevap dayatmak değil, bakış biçimini netleştirmektir.',
  ],
} as const;

export const landingHowItWorks = {
  id: 'nasil-calisir',
  title: 'Nasıl çalışır?',
  steps: [
    {
      n: '01',
      title: 'Zamanı belirler',
      text: 'Tarih, konum ve günün sınırları netleştirilir.',
    },
    {
      n: '02',
      title: 'Hesaplanabilir verileri toplar',
      text: 'Ölçülebilir gökyüzü ve takvim verileri derlenir.',
    },
    {
      n: '03',
      title: 'Katmanları ayrı ayrı işler',
      text: 'Her sistem kendi yönteminde kalır; karıştırılmaz.',
    },
    {
      n: '04',
      title: 'Ortak örüntüleri görünür kılar',
      text: 'Yan yana duran katmanlarda tekrar eden yapıları işaretler.',
    },
  ],
} as const;

export const landingDailyPreview = {
  id: 'ornek-analiz',
  title: 'Örnek Analiz',
  subtitle:
    'Kendi doğum bilgilerinle gerçek analiz hattını çalıştır. Sonuç backend’den gelir; sabit demo metin yoktur.',
} as const;

export const landingPrinciples = {
  id: 'yaklasim',
  titleLines: ['Atlas sana ne olacağını söylemez.', 'Neye baktığını daha açık görmene yardım eder.'],
  principles: [
    'Hesaplanan ile yorumlanan ayrılır.',
    'Kaynak ve yöntem görünür kalır.',
    'Son karar her zaman kullanıcıya aittir.',
  ],
} as const;

export const landingFinalCta = {
  id: 'basla',
  titleLines: ['Bakmak başka.', 'Görmek başka.'],
  body: 'Katmanları tek bir yerde incele.',
  primaryCta: { label: 'Atlas’ı aç', to: '/atlas' },
  secondaryCta: { label: 'Nasıl çalıştığını gör', sectionId: 'nasil-calisir' },
} as const;

export const landingFooter = {
  brand: 'ATLAS',
  tagline: 'Katmanlı zekâ. Açık yöntem.',
  links: [
    { label: 'Gizlilik', to: '/about#gizlilik' },
    { label: 'Kullanım şartları', to: '/about#sartlar' },
    { label: 'İletişim', to: '/about#iletisim' },
  ],
} as const;

export const landingNav = [
  { label: 'Atlas', to: '/atlas' as const },
  { label: 'Sembolik Analiz', to: '/analysis/symbolic' as const },
  { label: 'Örnek Analiz', sectionId: 'ornek-analiz' as const },
  { label: 'Nasıl Çalışır?', sectionId: 'nasil-calisir' as const },
];

/** User-facing result section titles — never engine names. */
export const symbolicResultSections = [
  { id: 'summary', title: 'Kısa Özet' },
  { id: 'pattern', title: 'Ana Örüntü' },
  { id: 'balance', title: 'İç Denge' },
  { id: 'echoes', title: 'Sembolik Yankılar' },
  { id: 'meaning', title: 'Anlam Katmanı' },
  { id: 'names', title: 'Destekleyici Esmalar' },
  { id: 'tensions', title: 'Gerilim Noktaları' },
  { id: 'reflection', title: 'Düşünme Alanı' },
  { id: 'method', title: 'Yöntem ve Sınırlar' },
] as const;
