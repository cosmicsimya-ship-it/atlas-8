export const landingHero = {
  brand: 'ATLAS',
  eyebrow: 'Cosmic Simya',
  /** Locked primary manifesto — do not rewrite. */
  titleLines: ['Her şey zaten ortada.', 'Mesele nasıl okuduğun.'],
  /** Method / supporting statement — secondary to manifesto. */
  methodLines: ['Tek cevap aramaz.', 'Denklem kurar.'],
  body:
    'Atlas farklı katmanları birlikte okur, tekrar eden yapıları yakalar ve dağınık görünen verilerin nerede aynı noktaya baktığını gösterir.',
  primaryCta: { label: 'Atlas’a Gir', to: '/atlas' },
  secondaryCta: { label: 'Nasıl okur?', sectionId: 'her-sey-orada' },
} as const;

export const landingAlreadyThere = {
  id: 'her-sey-orada',
  eyebrow: 'Okuma',
  title: 'Her şey zaten orada.',
  accent: 'Mesele nasıl okuduğun.',
  body:
    'Bir tarih. Bir tekrar. Bir davranış. Bir sembol. Bir soru. Tek başlarına parçadırlar. Atlas parçaları çoğaltmaz. Aralarındaki ilişkiyi arar.',
} as const;

export const landingConvergence = {
  id: 'yakinasma',
  eyebrow: 'Yakınsama',
  title: 'Bir işaret yetmez.',
  paragraphs: [
    'Atlas tek bir göstergeden hüküm üretmez.',
    'Birden fazla bağımsız katman aynı noktaya baktığında bunu bir yakınsama olarak okur — mistik bir kesinlik motoru olarak değil, dayanak gücü artan bir denklem olarak.',
  ],
  punchline:
    'Güçlü yorum, tek bir işaretten değil; bağımsız işaretlerin aynı yapıyı göstermesinden doğar. Çelişki de veridir.',
} as const;

export const landingPatternSelf = {
  id: 'oruntu',
  eyebrow: 'İnsan',
  title: 'Sen veri değilsin.',
  accent: 'Bir örüntü mimarisisin.',
  paragraphs: [
    'Atlas seni tek bir doğum tarihine, tek bir teste, tek bir konuşmaya veya tek bir sembole indirgemez.',
    'Bağlam değişir. İnsan değişir. Bazı yapılar tekrar eder. Atlas ikisini birbirinden ayırmaya çalışır.',
  ],
} as const;

/** Windows Atlas looks through — not a feature catalog. */
export const landingLooks = {
  id: 'nereye-bakar',
  eyebrow: 'Pencereler',
  title: 'Atlas nereye bakar?',
  items: [
    {
      title: 'Zamana bakar.',
      text: 'Döngüler, tarihler, dönemler.',
    },
    {
      title: 'Yapıya bakar.',
      text: 'Karakter, tekrar, davranış.',
    },
    {
      title: 'Sembole bakar.',
      text: 'Rüyalar, imgeler, çağrışımlar.',
    },
    {
      title: 'Geçmişe bakar.',
      text: 'Önceki konuşmalar, tekrar eden meseleler.',
    },
    {
      title: 'Çelişkiye bakar.',
      text: 'Birbirini desteklemeyen verileri de hesaba katar.',
    },
    {
      title: 'Kesişime bakar.',
      text: 'Farklı katmanların aynı noktaya gelip gelmediğini ayırt etmeye çalışır.',
    },
  ],
} as const;

/** Soft live trial — demoted from SaaS “sample analysis” framing. */
export const landingDailyPreview = {
  id: 'dene',
  title: 'Bir kez bak.',
  subtitle:
    'Doğum bilgilerinle gerçek analiz hattını çalıştır. Sabit demo metin yok; sonuç sistemden gelir.',
} as const;

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

export const landingFinalCta = {
  id: 'basla',
  titleLines: ['Denklem orada.', 'Okumaya hazır mısın?'],
  body: 'Atlas’a gir. Bir yerden başlayalım.',
  accountHint:
    'Hesap zorunlu değil. Açarsan bağlam, tekrarlar ve kayıtlar seninle kalır.',
  primaryCta: { label: 'Atlas’a Gir', to: '/atlas' },
  secondaryCta: { label: 'Manifestoyu oku', to: '/about' },
} as const;

export const landingFooter = {
  brand: 'ATLAS',
  tagline: 'Örüntüyü okur. Denklem kurar.',
  links: [
    { label: 'Gizlilik', to: '/about#gizlilik' },
    { label: 'Kullanım şartları', to: '/about#sartlar' },
    { label: 'İletişim', to: '/about#iletisim' },
  ],
} as const;

/** Official Cosmic Simya social profiles — footer / about. */
export const socialLinks = {
  instagram: {
    href: 'https://www.instagram.com/cosmicsimya/',
    label: 'Instagram',
    ariaLabel: 'Cosmic Simya Instagram profilini yeni sekmede aç',
  },
  telegram: {
    href: 'https://t.me/cosmicsimya',
    label: 'Telegram',
    ariaLabel: 'Cosmic Simya Telegram hesabını yeni sekmede aç',
  },
} as const;

export const landingNav = [
  { label: 'Atlas', to: '/atlas' as const },
  { label: 'Yakınsama', sectionId: 'yakinasma' as const },
  { label: 'Nereye bakar?', sectionId: 'nereye-bakar' as const },
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
