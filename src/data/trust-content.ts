/**
 * Trust / legal / support content — Privacy(KVKK), Membership Terms,
 * Refund/Cancellation, FAQ, Contact, Support.
 *
 * Every factual claim here is scoped to what the current ATLAS
 * implementation actually does (account store, subscription store, billing
 * provider, session cookies) — nothing is asserted that isn't backed by
 * code. Sections that require a business decision or legal review are
 * marked with `needsLegalReview` / `needsBusinessDecision` so the page can
 * render an explicit draft notice instead of silently presenting draft
 * text as settled policy.
 */

export type ContactTopicOption = { value: 'general' | 'billing' | 'privacy' | 'other'; label: string };

export const CONTACT_TOPICS: ContactTopicOption[] = [
  { value: 'general', label: 'Genel soru' },
  { value: 'billing', label: 'Üyelik / ödeme' },
  { value: 'privacy', label: 'Gizlilik / veri talebi' },
  { value: 'other', label: 'Diğer' },
];

/** Footer / help navigation — dedicated trust & support routes. */
export const legalNav = [
  { label: 'Gizlilik / KVKK', to: '/gizlilik' },
  { label: 'Üyelik Sözleşmesi', to: '/uyelik-sozlesmesi' },
  { label: 'İade ve İptal', to: '/iade-iptal' },
  { label: 'SSS', to: '/sss' },
  { label: 'Destek', to: '/destek' },
  { label: 'İletişim', to: '/iletisim' },
] as const;

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
  needsLegalReview?: boolean;
  needsBusinessDecision?: boolean;
};

/** ─────────────────────────── Privacy / KVKK ─────────────────────────── */

export const privacyIntro =
  'Bu sayfa, Cosmic Simya / Atlas ürünü içinde hangi veri kategorilerinin işlendiğini, hangi amaçla kullanıldığını ve kullanıcı olarak sahip olduğun kanalları özetler. Aşağıdaki maddeler mevcut uygulamanın gerçek davranışına dayanır; iddia edilmeyen bir işleme biçimi burada yer almaz.';

export const privacySections: LegalSection[] = [
  {
    id: 'operator',
    title: 'Veri sorumlusu / operatör',
    paragraphs: [
      'Bu hizmeti işleten tüzel kişi veya işletmenin resmi unvanı ve iletişim bilgileri, KVKK madde 10 kapsamındaki aydınlatma yükümlülüğünün bir parçası olarak bu bölümde yayınlanır.',
    ],
    needsLegalReview: true,
  },
  {
    id: 'categories',
    title: 'İşlenen veri kategorileri',
    paragraphs: ['Uygulama aşağıdaki veri kategorilerini, ilgili özelliği kullandığın ölçüde işler:'],
    list: [
      'Hesap / kimlik verisi — e-posta, kullanıcı adı, şifre (yalnızca bcrypt ile geri döndürülemez biçimde saklanır), tercih edilen giriş yöntemi (e-posta/şifre veya Google ile giriş).',
      'Kullanıcı içeriği — Atlas ile yaptığın sohbetler, kaydettiğin doğum/profil bilgileri, günlük check-in kayıtların, Atlas’ın hatırladığı bağlam notları (hafıza).',
      'Üyelik ve ödeme ilişkisi verisi — plan durumun (Free/Prime), abonelik durumu ve yenileme tarihleri. Kart bilgilerin ATLAS sunucularında saklanmaz; ödeme, seçilen ödeme sağlayıcısı (Iyzico) üzerinden işlenir.',
      'Oturum / çerez verisi — oturumunu taşıyan HttpOnly bir çerez ve CSRF (istek sahteciliği) koruması için ikinci bir çerez. Üçüncü taraf reklam veya takip çerezi kullanılmaz.',
      'Kullanım verisi — servis içi analitik olaylar (örn. hangi sayfanın görüntülendiği) ve maliyet/kullanım ölçümü; bu veriler yalnızca iç operasyon amaçlı tutulur, dış pazarlama araçlarına aktarılmaz.',
      'İsteğe bağlı entegrasyon verisi — Google ile giriş yaparsan doğrulanmış e-posta adresin; Telegram üzerinden hesabını bağlarsan Telegram kimliğin.',
    ],
  },
  {
    id: 'purposes',
    title: 'İşleme amaçları',
    paragraphs: [
      'Veriler; hesabını çalıştırmak, Atlas’ın kişisel bağlamı taşıyabilmesini sağlamak, üyelik ve ödeme durumunu yönetmek, hizmeti güvenli tutmak (oturum ve CSRF koruması, kötüye kullanım tespiti) ve destek taleplerini yanıtlamak amacıyla işlenir. Pazarlama amaçlı üçüncü taraf paylaşımı yapılmaz.',
    ],
  },
  {
    id: 'processors',
    title: 'Hizmet sağlayıcılar (yüksek seviye)',
    paragraphs: [
      'Uygulama, belirli işlevler için aşağıdaki dış hizmet sağlayıcılarla çalışabilir; her biri yalnızca ilgili özelliği kullandığında devreye girer:',
    ],
    list: [
      'Yapay zekâ yanıt üretimi için bir LLM sağlayıcısı (OpenAI).',
      'Sesli yanıt (Lara Voice) için bir metin-okuma sağlayıcısı, yalnızca özellik kullanıldığında.',
      'Ödeme işlemleri için bir ödeme kuruluşu (Iyzico); kart verisi bu sağlayıcı tarafından işlenir, Atlas sunucularında tutulmaz.',
      'Google ile giriş tercih edilirse Google OAuth.',
      'Telegram üzerinden Atlas’a erişmeyi tercih edersen Telegram bot altyapısı.',
    ],
  },
  {
    id: 'retention',
    title: 'Saklama ve silme',
    paragraphs: [
      'Veriler hesabın açık olduğu sürece saklanır. Hesabından kişisel verilerin silinmesini talep edebilirsin; bu talepler destek kanalından iletilir ve mevcut hesap yönetimi araçları üzerinden işlenir. Kesin saklama süreleri (log, fatura, yedekleme gibi kategoriler için) henüz ayrı ayrı belgelenmemiştir.',
    ],
    needsLegalReview: true,
  },
  {
    id: 'rights',
    title: 'Haklarınız ve iletişim kanalı',
    paragraphs: [
      'KVKK ve ilgili mevzuat kapsamındaki haklarını (verilerine erişim, düzeltme, silme, işlemeye itiraz gibi) kullanmak istersen İletişim veya Destek sayfası üzerinden bize ulaşabilirsin. Bu hakların tam listesi ve başvuru usulü, hukuki inceleme sonrası bu sayfada netleştirilecektir.',
    ],
    needsLegalReview: true,
  },
];

/** ─────────────────────── Terms / Membership Agreement ─────────────────────── */

export const termsIntro =
  'Bu sayfa, Atlas Free ve Lara Prime üyeliğinin ticari ve kullanım şartlarını özetler. Metin taslak niteliğindedir; yürürlüğe girmeden önce hukuki inceleme gerektirir.';

export const termsSections: LegalSection[] = [
  {
    id: 'service',
    title: 'Hizmet tanımı',
    paragraphs: [
      'Cosmic Simya, Atlas adlı yapay zekâ destekli analiz aracına ve Lara Prime adlı ücretli dijital üyeliğe erişim sağlayan bir hizmettir. Atlas; astroloji, numeroloji ve sembolik analiz gibi katmanları birlikte okuyan bir yorumlama aracıdır — kesin kehanet, tıbbi, hukuki veya finansal danışmanlık hizmeti değildir.',
    ],
  },
  {
    id: 'account',
    title: 'Hesap gereksinimleri',
    paragraphs: [
      'Hizmetin bazı bölümlerini kullanmak için bir hesap oluşturman gerekir. Hesap bilgilerinin doğruluğundan ve hesabının güvenliğinden sen sorumlusun.',
    ],
  },
  {
    id: 'plans',
    title: 'Free ve Prime ayrımı',
    paragraphs: [
      'Atlas Free, sohbet ve sembolik analiz gibi temel deneyimi ücretsiz sunar. Lara Prime, aylık ücretli bir dijital üyeliktir; kişisel merkez, günlük check-in, 7 günlük görünüm, Lara Voice, görsel ile analiz ve daha yüksek günlük kullanım gibi ek yüzeyler açar. Prime kapsamındaki tam özellik listesi Lara Prime sayfasında güncel tutulur.',
    ],
  },
  {
    id: 'subscription',
    title: 'Üyeliğin niteliği',
    paragraphs: [
      'Lara Prime, aylık olarak otomatik yenilenen bir abonelik hizmetidir. Fiyat, hesabına açık biçimde gösterilir ve ödeme sağlayıcısı üzerinden tahsil edilir. Detaylı yenileme, iptal ve iade koşulları için İade ve İptal sayfasına bakabilirsin.',
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Kabul edilebilir kullanım',
    paragraphs: [
      'Hizmeti yasa dışı amaçlarla, başkalarının haklarını ihlal edecek biçimde veya sistemin güvenliğini/işleyişini bozacak şekilde (otomatik kötüye kullanım, tersine mühendislik girişimi gibi) kullanamazsın.',
    ],
  },
  {
    id: 'availability',
    title: 'Hizmet değişiklikleri ve kesintiler',
    paragraphs: [
      'Hizmet geliştirme aşamasındadır; özellikler zaman içinde değişebilir, geçici kesintiler yaşanabilir. Kritik kararlarında Atlas çıktısı tek başına yeterli dayanak kabul edilmemelidir.',
    ],
  },
  {
    id: 'ip',
    title: 'Fikri mülkiyet ve içerik',
    paragraphs: [
      'Atlas’ın ürettiği yanıtlar kişisel kullanımın içindir. Uygulamanın marka, tasarım ve yazılım unsurları Cosmic Simya’ya aittir. Kullanıcı olarak paylaştığın içerik (mesajlar, profil bilgilerin) hesabına bağlı kalır ve Gizlilik/KVKK sayfasında açıklanan kapsamın dışında kullanılmaz.',
    ],
  },
  {
    id: 'disclaimer',
    title: 'Sorumluluk sınırı',
    paragraphs: [
      'Atlas kesin gelecek garantisi vermez; tıbbi, hukuki veya finansal danışmanlığın yerine geçmez. Hizmet "olduğu gibi" sunulur. Sorumluluk sınırlarının tam hukuki metni, hukuki inceleme sonrası bu bölümde yer alacaktır.',
    ],
    needsLegalReview: true,
  },
  {
    id: 'termination',
    title: 'Fesih ve askıya alma',
    paragraphs: [
      'Hesabını istediğin zaman kapatabilirsin. Kabul edilebilir kullanım şartlarının ihlali durumunda hesabın askıya alınabilir; bu durumda destek kanalından bilgilendirilirsin. Askıya alma/fesih usulünün ayrıntılı çerçevesi hukuki inceleme sonrası netleştirilecektir.',
    ],
    needsLegalReview: true,
  },
  {
    id: 'contact',
    title: 'İletişim ve destek',
    paragraphs: [
      'Bu sözleşmeyle ilgili sorular için Destek veya İletişim sayfasını kullanabilirsin.',
    ],
  },
];

/** ─────────────────────────── Refund / Cancellation ─────────────────────────── */

export const refundIntro =
  'Lara Prime, aylık yenilenen bir dijital üyeliktir. Aşağıdaki bölümler yenilemeyi durdurma, mevcut dönem erişimi, iade talepleri ve faturalandırma sorunlarını ayrı ayrı ele alır. Kesin iade politikası henüz işletme tarafından nihai onaya bağlanmamıştır — bu sayfa, netleşecek karara kadar güvenli bir taslak çerçeve sunar.';

export const refundSections: LegalSection[] = [
  {
    id: 'cancel-renewal',
    title: 'Yenilemeyi iptal etme',
    paragraphs: [
      'Üyeliğinin bir sonraki dönemde otomatik olarak yenilenmesini istediğin zaman durdurabilirsin. İptal, gelecekteki faturalandırmayı durdurur; geçmiş dönem için ücret iadesi anlamına gelmez.',
    ],
  },
  {
    id: 'current-access',
    title: 'İptal sonrası mevcut dönem erişimi',
    paragraphs: [
      'Öngörülen davranış: iptal ettiğinde Prime erişimin hemen kesilmez; ödediğin mevcut faturalandırma döneminin sonuna kadar devam eder, dönem bittiğinde hesabın Atlas Free deneyimine döner. Bu, sistemdeki mevcut abonelik kaydında zaten yer alan "dönem sonunda iptal" alanına dayanır; ancak nihai politika olarak işletme tarafından henüz resmî biçimde onaylanmamıştır.',
    ],
    needsBusinessDecision: true,
  },
  {
    id: 'refund-requests',
    title: 'İade talepleri',
    paragraphs: [
      'Belirli bir tahsilat için iade talebinde bulunmak istersen Destek sayfasından bize ulaşabilirsin. Hangi durumlarda iadenin yapılacağına dair kesin kriterler (örn. ilk 14 gün, teknik arıza, yanlış tahsilat) henüz nihai olarak karara bağlanmamıştır; bu bölüm, karar netleştikçe güncellenecektir.',
    ],
    needsBusinessDecision: true,
  },
  {
    id: 'digital-delivery',
    title: 'Dijital hizmet teslimatı',
    paragraphs: [
      'Lara Prime, fiziksel bir ürün değil; hesabına bağlı dijital bir hizmettir. Erişim, ödeme onaylandıktan sonra hesabında etkinleşir. Dijital hizmetlerde cayma hakkının ne şekilde uygulandığı, mesafeli satış mevzuatına uygun biçimde hukuki inceleme sonrası bu sayfada netleştirilecektir.',
    ],
    needsLegalReview: true,
  },
  {
    id: 'billing-errors',
    title: 'Faturalandırma sorunları',
    paragraphs: [
      'Beklenmedik bir tahsilat, başarısız ödeme veya yanlış tutar gördüysen Destek sayfasındaki üyelik/ödeme kanalından bildir. Talepler sırayla incelenir.',
    ],
  },
];

/** ─────────────────────────────── FAQ ─────────────────────────────── */

export type FaqItem = { q: string; a: string };

export const faqItems: FaqItem[] = [
  {
    q: 'Lara Prime nedir?',
    a: 'Lara Prime, Atlas’ın ücretsiz deneyiminin üzerine eklenen, aylık ücretli bir dijital üyeliktir. Kişisel merkez, günlük check-in, 7 günlük görünüm, Lara Voice (sesli yanıt), görsel ile analiz ve daha yüksek günlük kullanım gibi ek yüzeyler açar.',
  },
  {
    q: 'Prime ile tam olarak ne alıyorum?',
    a: 'Güncel ve tam kapsamlı liste Lara Prime sayfasında yer alır. Genel hatlarıyla: kişisel merkez (My Prime), günlük check-in, yaklaşan 7 günün görünümü, Türkçe/İngilizce sesli yanıt, görsel ile analiz ve daha derin kişisel bağlam.',
  },
  {
    q: 'Üyelik aylık mı?',
    a: 'Evet. Lara Prime aylık faturalandırılan bir abonelik hizmetidir; fiyat hesabına açık biçimde gösterilir.',
  },
  {
    q: 'Otomatik olarak yenileniyor mu?',
    a: 'Evet, üyelik her ay otomatik olarak yenilenir. Yenilemeyi istediğin zaman durdurabilirsin; ayrıntı için İade ve İptal sayfasına bakabilirsin.',
  },
  {
    q: 'Nasıl iptal ederim?',
    a: 'Üyelik yönetimi ekranından yenilemeyi durdurabilirsin. İptal, gelecekteki faturalandırmayı durdurur. Sorun yaşarsan Destek sayfasından bize ulaşabilirsin.',
  },
  {
    q: 'İptal sonrası erişimim ne olur?',
    a: 'Öngörülen davranış, mevcut ödenmiş dönemin sonuna kadar Prime erişiminin sürmesidir; dönem bittiğinde hesabın Atlas Free deneyimine döner. Ayrıntı için İade ve İptal sayfasındaki ilgili başlığa bakabilirsin — bu davranış henüz işletme tarafından nihai olarak onaylanmamıştır.',
  },
  {
    q: 'Destek ekibine nasıl ulaşırım?',
    a: 'Destek sayfasındaki iletişim yolunu kullanabilirsin. Genel sorular için İletişim sayfası, üyelik/ödeme konuları için Destek sayfası daha uygundur.',
  },
  {
    q: 'Faturalandırma sorunu yaşarsam ne olur?',
    a: 'Destek sayfasındaki "Üyelik / ödeme" konu başlığından bize ulaşabilirsin. Talepler sırayla incelenir; kesin bir yanıt süresi taahhüt edilmemektedir.',
  },
  {
    q: 'Atlas tıbbi, hukuki veya finansal bir uzman mı?',
    a: 'Hayır. Atlas; astroloji, numeroloji ve sembolik analiz katmanlarını birlikte okuyan bir yorumlama aracıdır. Kesin gelecek garantisi vermez; tıbbi, hukuki veya finansal danışmanlığın yerine geçmez. Kritik kararlarda bağımsız, uzman doğrulaması gerekir.',
  },
  {
    q: 'Verilerim nasıl işleniyor?',
    a: 'Hesap, içerik ve üyelik verilerinin hangi kapsamda işlendiği Gizlilik / KVKK sayfasında ayrıntılı biçimde açıklanır. Kart bilgin Atlas sunucularında saklanmaz; ödeme sağlayıcısı üzerinden işlenir.',
  },
  {
    q: 'Free ve Prime arasındaki fark nedir?',
    a: 'Atlas Free; sohbet, sembolik analiz ve dosya yüklemeyi ücretsiz sunar. Lara Prime bunun üzerine kişisel merkez, günlük check-in, 7 günlük görünüm, Lara Voice, görsel ile analiz ve daha yüksek günlük kullanım ekler. Tam karşılaştırma Lara Prime sayfasındaki tabloda yer alır.',
  },
];
