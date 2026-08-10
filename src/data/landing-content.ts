export const landingHero = {
  brand: 'ATLAS',
  eyebrow: 'Cosmic Simya',
  /** Locked primary manifesto — do not rewrite. */
  titleLines: ['Her şey zaten ortada.', 'Mesele nasıl okuduğun.'],
  /** Brand method line — secondary to manifesto. */
  methodLines: ['Tek cevap aramaz.', 'Denklem kurar.'],
  /** Clear product explanation — Cosmic Simya = platform, Atlas = analysis intelligence. */
  body:
    'Atlas; astroloji, numeroloji, semboller ve kişisel örüntüler gibi katmanları birlikte okuyan Cosmic Simya analiz zekâsıdır.',
  primaryCta: { label: 'Atlas’a Gir', to: '/atlas' },
} as const;

/** What Atlas does — first clarifying section. */
export const landingWhatAtlasDoes = {
  id: 'nasil-calisir',
  eyebrow: 'Ne yapar?',
  title: 'Tek bir işarete değil, örüntüye bakar.',
  body:
    'Atlas tek bir sistemi mutlak cevap olarak kullanmaz. Farklı bilgi katmanlarını birlikte değerlendirir; örtüşmeleri, tekrarları ve çelişkileri görünür hale getirir.',
} as const;

/** @deprecated Prefer landingWhatAtlasDoes — kept for section id continuity where linked. */
export const landingAlreadyThere = {
  id: 'her-sey-orada',
  eyebrow: landingWhatAtlasDoes.eyebrow,
  title: landingWhatAtlasDoes.title,
  accent: '',
  body: landingWhatAtlasDoes.body,
} as const;

/** Atlas difference — not five separate readings. */
export const landingDifference = {
  id: 'yakinasma',
  eyebrow: 'Fark',
  title: 'Beş ayrı yorum değil. Tek bir bağlantı haritası.',
  paragraphs: [
    'Atlas’ın işi astrolojiyi, numerolojiyi ve sembolleri ayrı ayrı cevaplamak değildir.',
    'Farklı katmanların aynı tema üzerinde nerede kesiştiğine bakar — mistik bir kesinlik motoru olarak değil, dayanak gücü artan bir okuma olarak.',
  ],
  punchline:
    'Aynı tema bir dönemde gökyüzünde, sayılarda ve senin sorularında tekrar ediyorsa Atlas bunu üç ayrı sonuç değil; bir örüntünün farklı görünümleri olarak okur. Çelişki de veridir.',
} as const;

/** Alias for existing ConvergenceSection import. */
export const landingConvergence = landingDifference;

/** Example questions — concrete prompts, not testimonials. */
export const landingExampleQuestions = {
  id: 'ornek-sorular',
  eyebrow: 'Örnekler',
  title: 'Atlas’a ne sorabilirsin?',
  body: 'Örnek sorular — sohbette kendi sözlerinle başlayabilirsin.',
  questions: [
    'Şu anda hayatımda hangi tema tekrar ediyor?',
    'Doğum haritamla numerolojik döngüm aynı döneme mi işaret ediyor?',
    'Son zamanlarda gördüğüm bu rüyanın tekrar eden sembolleri ne anlatıyor?',
    'Bu yılın benim için öne çıkan dönemleri neler?',
    'Daha önce konuştuklarımızla bugünkü sorum arasında bir bağlantı var mı?',
  ],
  cta: { label: 'Atlas’a Sor', to: '/atlas' as const },
} as const;

/** Soft human framing — kept concise; detail lives in difference + systems. */
export const landingPatternSelf = {
  id: 'oruntu',
  eyebrow: 'İnsan',
  title: 'Sen veri değilsin.',
  accent: 'Bir örüntü mimarisisin.',
  paragraphs: [
    'Atlas seni tek bir doğum tarihine, tek bir teste veya tek bir sembole indirgemez.',
    'Bağlam değişir. İnsan değişir. Bazı yapılar tekrar eder. Atlas ikisini birbirinden ayırmaya çalışır.',
  ],
} as const;

/**
 * Observation layers — product-truth aligned.
 * Chat surfaces: astrology (beta), numerology (beta), dream/symbol (live), memory (account), synthesis (chat).
 * No Qur’an verse-text claims.
 */
export const landingLooks = {
  id: 'nereye-bakar',
  eyebrow: 'Katmanlar',
  title: 'Atlas hangi sistemlerle çalışır?',
  items: [
    {
      index: '01',
      layer: 'Zaman',
      system: 'Astroloji',
      title: 'Zamana bakar.',
      text: 'Döngüler, dönemler ve göksel zamanlama — kehanet değil, bağlamsal çerçeve.',
    },
    {
      index: '02',
      layer: 'Sayılar',
      system: 'Numeroloji',
      title: 'Sayılara bakar.',
      text: 'Doğum tarihi, isim ve sayısal örüntüler üzerinden yapısal bir harita kurar.',
    },
    {
      index: '03',
      layer: 'Sembol',
      system: 'Sembolik okuma',
      title: 'Sembole bakar.',
      text: 'Rüyalar, imgeler, tekrar eden semboller ve çağrışımlar.',
    },
    {
      index: '04',
      layer: 'Kişisel örüntü',
      system: 'Hafıza / Bağlam',
      title: 'Bağlama bakar.',
      text: 'Paylaştığın bilgilerdeki tekrar eden temalar, sorular ve bağlantılar.',
    },
    {
      index: '05',
      layer: 'Sentez',
      system: 'Atlas',
      title: 'Sentez kurar.',
      text: 'Katmanları tek tek sıralamak yerine ortaklıkları, çelişkileri ve tekrarları ayırt etmeye çalışır.',
    },
  ],
} as const;

/** Memory / context — privacy-aligned, no forever-claims. */
export const landingMemory = {
  id: 'baglam',
  eyebrow: 'Bağlam',
  title: 'Konuşma bittiğinde her şeyin silinmesi gerekmez.',
  body:
    'Hesap açarsan Atlas, gizlilik kuralları kapsamında kaydettiğin ilgili bağlamı sonraki okumalarda kullanabilir. Zorunlu değildir; izinlerinle sınırlıdır.',
} as const;

/**
 * Landing trial — symbolic analysis API (ebced/esma), not the daily-analysis engine.
 * Copy must not promise “bugünün zamanlaması” as a dedicated daily product.
 */
export const landingDailyPreview = {
  id: 'dene',
  eyebrow: 'Dene',
  title: 'Bir örüntüye bak.',
  subtitle:
    'Doğum bilgilerini gir. Atlas sembolik analiz hattını çalıştırarak kısa bir başlangıç okuması oluştursun. Sabit demo metin yok; sonuç sistemden gelir.',
  cta: 'Analizi Başlat',
} as const;

/** Alchemy / synthesis meaning — not potion magic. */
export const landingAlchemy = {
  id: 'sentez',
  eyebrow: 'Simya',
  title: 'Parçaları toplamak değil. İlişkiyi dönüştürmek.',
  body:
    'Cosmic Simya’da simya; bilgi yığmak değil, parçalar arasındaki ilişkiyi görünür kılarak anlam üretmektir.',
  steps: [
    { label: 'Gözlem', text: 'Veriyi olduğu haliyle gör.' },
    { label: 'Bağlantı', text: 'Tekrarları, çelişkileri ve kesişimleri bul.' },
    { label: 'Sentez', text: 'Parçaları daha büyük bir bağlam içinde oku.' },
  ],
} as const;

/** Principles / boundaries teaser. */
export const landingManifestoTeaser = {
  id: 'yaklasim',
  titleLines: ['Veri başka şeydir.', 'Anlam başka.'],
  principles: [
    'Tek işaret karar vermez.',
    'Fal bakmaz. Kehanet üretmez.',
    'Çıkarım ile veri birbirinden ayrılır.',
    'Çelişki gizlenmez; ayırt edilir.',
    'Kesinlik iddia edilmez; dayanak gücü görünür kılınır.',
  ],
} as const;

/** Atlas positioning — no AI jargon. */
export const landingIntelligence = {
  id: 'atlas-zeka',
  eyebrow: 'Atlas',
  title: 'Atlas cevap makinesi değildir. Bir örüntü okuma sistemidir.',
  body:
    'Soruyu tek bir etikete indirgemez. Katmanlar arasında bağ kurar, çelişkiyi ayırt eder ve dayanak gücünü görünür kılar.',
  cta: { label: 'Atlas’a Gir', to: '/atlas' as const },
} as const;

export const landingFinalCta = {
  id: 'basla',
  titleLines: ['Denklem orada.', 'Okumaya hazır mısın?'],
  body: 'Atlas’a gir. Bir yerden başlayalım.',
  accountHint:
    'Hesap zorunlu değil. Açarsan bağlam, tekrarlar ve kayıtlar seninle kalır.',
  primaryCta: { label: 'Atlas’a Gir', to: '/atlas' },
  secondaryCta: { label: 'Nasıl çalışır?', sectionId: 'nasil-calisir' },
} as const;

export const landingFooter = {
  brand: 'Cosmic Simya',
  systemMark: 'ATLAS',
  tagline: 'Örüntüyü okur. Denklem kurar.',
  trust:
    'Atlas kesin gelecek garantisi vermez; profesyonel tıbbi, hukuki veya finansal danışmanlığın yerine geçmez. Sembolik sistemleri analiz aracı olarak kullanır.',
  links: [
    { label: 'Atlas', to: '/atlas' },
    { label: 'Nasıl çalışır?', to: '/#nasil-calisir' },
    { label: 'Hakkında', to: '/about' },
    { label: 'Gizlilik', to: '/about#gizlilik' },
    { label: 'Kullanım şartları', to: '/about#sartlar' },
    { label: 'İletişim', to: '/about#iletisim' },
  ],
} as const;

/**
 * Official Cosmic Simya social profiles — footer / about only.
 * Hierarchy: Instagram = brand social; Telegram = secondary channel.
 */
export const socialLinks = {
  instagram: {
    href: 'https://www.instagram.com/cosmic_simya/',
    handle: 'cosmic_simya',
    label: 'Instagram',
    ariaLabel: 'Instagram',
  },
  telegram: {
    href: 'https://t.me/cosmicsimya',
    handle: 'cosmicsimya',
    label: 'Telegram',
    ariaLabel: 'Cosmic Simya Telegram kanalını yeni sekmede aç',
  },
} as const;

export const landingNav = [
  { label: 'Atlas', to: '/atlas' as const },
  { label: 'Katmanlar', sectionId: 'nereye-bakar' as const },
  { label: 'Nasıl çalışır?', sectionId: 'nasil-calisir' as const },
  { label: 'Manifesto', to: '/about' as const },
];

/** Full manifesto — About page + product identity spine. */
export const atlasManifesto = {
  title: 'Manifesto',
  lead: 'Her şey zaten orada.\nMesele neye baktığın değil, nasıl okuduğun.',
  sections: [
    {
      body: 'İnsan kendisini tek bir hikâyeden ibaret sanır. Oysa hayat aynı anda birçok dilde konuşur: zaman, tekrar, hafıza, karakter, seçimler, çelişkiler, döngüler, semboller.',
    },
    {
      body: 'Bir işaret tek başına hüküm vermez. Ama bağımsız işaretler tekrar tekrar aynı yere bakıyorsa artık karşımızda rastgele parçalar değil, bir yapı vardır.',
    },
    {
      body: 'Atlas o yapıyı arar. Tek cevap üretmek için değil. Denklemi görmek için.',
    },
    {
      body: 'Atlas geleceği ilan etmez. İnsanı birkaç etikete indirgemez. Bir sonucu zorla kabul ettirmez.',
    },
    {
      body: 'Parçaları toplar. Çelişkileri ayırır. Tekrarı görür. Bağlamı korur. Ve görünürde birbirinden bağımsız duran noktalar arasında bir hat varsa onu görünür hale getirir.',
    },
    {
      body: 'Çünkü veri başka şeydir. Anlam başka. Atlas’ın işi veri göstermek değildir. Atlas’ın işi örüntüyü okumaktır.',
    },
  ],
} as const;

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
