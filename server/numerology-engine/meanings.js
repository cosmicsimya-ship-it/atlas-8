/**
 * Interpretive meaning profiles — deterministic, school-labeled, non-prophetic.
 * Separates calculation from commentary.
 */

/** @type {Record<number, { label: string, core: string, strengths: string[], shadows: string[], relationships: string, career: string, lifeLesson: string, development: string }>} */
export const NUMBER_PROFILES = {
  1: {
    label: 'Başlangıç / Öncülük',
    core: 'Bağımsız yön belirleme, inisiyatif ve kendi çizgisini açma.',
    strengths: ['inisiyatif', 'kararlılık', 'özgünlük', 'liderlik potansiyeli'],
    shadows: ['inat', 'yalnızlık baskısı', 'başkalarını ezer gibi görünme', 'sabırsızlık'],
    relationships: 'Özgürlük ister; yakınlıkta kontrol veya mesafe salınımı yaşanabilir.',
    career: 'Girişim, yön belirleme, bağımsız üretim ve öncü roller doğal gelir.',
    lifeLesson: 'Kendi yolunu açarken başkalarının alanına saygı.',
    development: 'Tek başına güç ile birlikte hareket etme dengesini kur.',
  },
  2: {
    label: 'İkili / Uyum',
    core: 'İşbirliği, hassasiyet, diplomatik denge ve ilişki aynaları.',
    strengths: ['empati', 'diplomasi', 'dinleme', 'orta yolu bulma'],
    shadows: ['kararsızlık', 'aşırı uyum', 'sınır erimesi', 'başkalarının enerjisini taşıma'],
    relationships: 'Yakınlıkta ayna tutar; sınır koyamadığında kendini kaybedebilir.',
    career: 'Ortaklık, danışmanlık, arabuluculuk, destekleyici uzmanlık.',
    lifeLesson: 'Uyum ile kendini inkâr etmeme.',
    development: 'Hayır demeyi ve kendi ritmini korumayı öğren.',
  },
  3: {
    label: 'İfade / Yaratıcılık',
    core: 'Söz, yaratım, neşe ve iletişimin genişlemesi.',
    strengths: ['ifade', 'yaratıcılık', 'sosyal zekâ', 'espri'],
    shadows: ['dağınık dikkat', 'yüzeysellik', 'onay arayışı', 'sözü işe bağlamama'],
    relationships: 'Canlılık getirir; derinlik istenince dağılma riski.',
    career: 'İletişim, sanat, eğitim, medya, performans.',
    lifeLesson: 'İfadeyi disiplinle ürünleştirmek.',
    development: 'Tek kanala odaklanıp yaratımı tamamla.',
  },
  4: {
    label: 'Yapı / Düzen',
    core: 'Sağlam zemin, sistem, emek ve sürdürülebilir düzen.',
    strengths: ['disiplin', 'güvenilirlik', 'sistem kurma', 'sabır'],
    shadows: ['katılık', 'aşırı kontrol', 'değişime direnç', 'işe gömülme'],
    relationships: 'Güven ve tutarlılık sunar; esneklik eksikse ilişki sertleşir.',
    career: 'Mühendislik, operasyon, finans, yapılandırma, uzun vadeli projeler.',
    lifeLesson: 'Düzen ile esnekliği birlikte tutmak.',
    development: 'Kontrolü bırakılabilecek alanları bilinçli seç.',
  },
  5: {
    label: 'Hareket / Özgürlük',
    core: 'Değişim, deneyim, hareket ve sınırları genişletme.',
    strengths: ['uyum sağlama', 'merak', 'cesaret', 'çok yönlülük'],
    shadows: ['dağınıklık', 'kaçış', 'bağlanma korkusu', 'aşırılık'],
    relationships: 'Özgürlük şart; baskı hissedince uzaklaşabilir.',
    career: 'Seyahat, satış, medya, kriz yönetimi, değişken alanlar.',
    lifeLesson: 'Özgürlüğü sorumlulukla taşımak.',
    development: 'Seçimlerini tamamlanmış deneyimlere dönüştür.',
  },
  6: {
    label: 'Sorumluluk / Bakım',
    core: 'Koruma, sorumluluk, estetik ve ailevi/ilişkisel bakım.',
    strengths: ['şefkat', 'sorumluluk', 'denge kurma', 'estetik duygu'],
    shadows: ['aşırı yüklenme', 'kurtarıcılık', 'suçluluk', 'sınır ihlali'],
    relationships: 'Bakım verir; karşılık görmeyince kırılır veya kontrol eder.',
    career: 'Hizmet, eğitim, tasarım, sağlık destek, topluluk işleri.',
    lifeLesson: 'Başkalarını taşırken kendini de taşımak.',
    development: 'Sorumluluk ile öz-bakım arasında net sınır koy.',
  },
  7: {
    label: 'Analiz / İçgözlem',
    core: 'Derinlik, analiz, ruhsal/zihinsel araştırma ve yalnızlaşma ihtiyacı.',
    strengths: ['analiz', 'sezgi', 'araştırma', 'özgün düşünce'],
    shadows: ['aşırı mesafe', 'kuşku', 'izolasyon', 'zihinsel döngü'],
    relationships: 'Yakınlık ister ama mahremiyet şart; yüzeysel bağları tolere etmez.',
    career: 'Araştırma, strateji, teknik uzmanlık, danışmanlık, spiritüel/analitik alanlar.',
    lifeLesson: 'Anlamak ile bağ kurmayı ayırmamak.',
    development: 'İçgörüyü paylaşılabilir dile çevir.',
  },
  8: {
    label: 'Güç / Maddi Gerçeklik',
    core: 'Otorite, kaynak yönetimi, sonuç üretme ve güç bilinci.',
    strengths: ['yönetim', 'sonuç odaklılık', 'kaynak bilinci', 'dayanıklılık'],
    shadows: ['kontrol takıntısı', 'statü baskısı', 'duygusal sertlik', 'tükenme'],
    relationships: 'Güç dengesi önemlidir; saygı görmezse mesafe açar.',
    career: 'Yönetim, girişim, finans, operasyonel liderlik.',
    lifeLesson: 'Gücü hizmet ve etik ile dengelemek.',
    development: 'Başarıyı yalnızca dış sonuçla ölçmeyi bırak.',
  },
  9: {
    label: 'Tamamlama / Evrensel',
    core: 'Bırakma, geniş bakış, hizmet ve döngüleri kapatma.',
    strengths: ['empati', 'vizyon', 'cömertlik', 'anlam arayışı'],
    shadows: ['martyrlik', 'sınır erimesi', 'bitirememe', 'idealizm yükü'],
    relationships: 'Derin bağ ister; kendini feda ederse ilişki bozulur.',
    career: 'Sanat, insanî alanlar, öğretim, iyileştirici/anlam odaklı işler.',
    lifeLesson: 'Vermek ile tükenmemek.',
    development: 'Bitmemiş döngüleri bilinçli kapat.',
  },
  11: {
    label: 'Usta — İlham / Sezgi',
    core: 'Yüksek sezgi, ilham kanalı ve hassas sinir sistemi; temel frekans 2.',
    strengths: ['sezgi', 'ilham', 'mesaj aktarma', 'duyarlılık', 'ruhsal yoğunluk'],
    shadows: [
      'aşırı uyarılma',
      'kararsızlık',
      'başkalarının enerjisini taşıma',
      'zihinsel yük',
      'ilişki aynalarında kaybolma',
    ],
    relationships: 'İkili aynalar yoğundur; sınır yoksa 2’nin gölgesi (bağımlılık/kararsızlık) baskınlaşır.',
    career: 'Rehberlik, sanat, danışmanlık, iletişim, ruhsal/yaratıcı köprü işleri.',
    lifeLesson: 'İlhamı gerçekliğe indirgemek; hassasiyeti güç sanmamak.',
    development: 'Sinir sistemini düzenle; ilhamı somut adımlara bağla.',
  },
  22: {
    label: 'Usta — Büyük Yapı',
    core: 'Vizyonu büyük ölçekte yapılandırma; temel frekans 4.',
    strengths: ['büyük resmi görme', 'sistem kurma', 'kolektif etki', 'disiplinli vizyon'],
    shadows: ['aşırı yük', 'mükemmeliyetçilik', 'ertelenmiş potansiyel', 'kontrol'],
    relationships: 'Ortak hedef ister; duygusal incelik ihmal edilirse soğuklaşır.',
    career: 'Kurumsal/proje ölçeği, mimari düşünce, toplumsal yapılar.',
    lifeLesson: 'Büyük vizyonu günlük emeğe bölmek.',
    development: '22’yi pasif hayal veya 4’ün katılığına düşürmeden adımla.',
  },
  33: {
    label: 'Usta — Şefkatli Öğreti',
    core: 'Yüksek şefkat ve öğreticilik; temel frekans 6.',
    strengths: ['şefkat', 'öğretme', 'iyileştirici varlık', 'sorumlu sevgi'],
    shadows: ['kurtarıcılık', 'tükenme', 'sınır yokluğu', 'suçluluk'],
    relationships: 'Bakım merkezlidir; karşılıklılık yoksa tükenir.',
    career: 'Öğretim, terapi destek, sanatla şifa, topluluk hizmeti.',
    lifeLesson: 'Şefkati kendi sınırın içinde tutmak.',
    development: '33 aktif yaşanıyorsa öğret; pasifte yalnızca yük taşıma.',
  },
};

/**
 * @param {number|null|undefined} n
 */
export function getNumberProfile(n) {
  if (n == null || !NUMBER_PROFILES[n]) return null;
  return NUMBER_PROFILES[n];
}

/**
 * Master-number deep layer.
 * @param {number} master
 */
export function getMasterAnalysis(master) {
  const profile = getNumberProfile(master);
  if (!profile || ![11, 22, 33].includes(master)) return null;
  const reduced = String(master)
    .split('')
    .reduce((s, d) => s + Number(d), 0);
  const base = getNumberProfile(reduced);
  return {
    master,
    reduced,
    display: `${master}/${reduced}`,
    masterFrequency: profile.core,
    reducedFrequency: base?.core ?? '',
    potential: profile.strengths,
    shadow: profile.shadows,
    nervousSystem:
      master === 11
        ? 'Yüksek hassasiyet ve aşırı uyarılma eğilimi; dinlenme ve filtre şart.'
        : master === 22
          ? 'Zihinsel/fiziksel yük kapasitesi yüksek; tükenme sınırını izlemek gerekir.'
          : 'Duygusal taşıma kapasitesi geniş; sınır olmadan tükenme riski.',
    inspirationVsReality:
      'Usta frekans ilham/vizyon taşır; indirgenmiş frekans günlük gerçeklik ve ilişki/yapı dersidir. İkisi birlikte okunur.',
    activeMode: profile.strengths.slice(0, 3).join(', '),
    passiveMode: profile.shadows.slice(0, 3).join(', '),
    maturationAgeHint:
      master === 11
        ? 'Çoğu ekolde 11’in bilinçli olgunlaşması 30’lu yaşlardan sonra belirginleşir; erken dönemde 2’nin gölgesi daha sık görülür.'
        : master === 22
          ? '22’nin yapısal olgunluğu genellikle yaşamın ikinci yarısında daha görünür hale gelir.'
          : '33’ün şefkatli öğreticiliği çoğu zaman uzun deneyim sonrası stabilize olur.',
    livedIndicators: [
      'İlham veya vizyon dönemleri ile tükenme/kaçış salınımı',
      'İlişkide ayna ve sınır temalarının tekrarı',
      'Potansiyeli bildiği halde erteleme veya aşırı yüklenme',
    ],
  };
}

/**
 * Karmic debt symbolic notes — explicitly non-literal past-life claims.
 * @param {number} debt
 */
export function getKarmicDebtNote(debt) {
  const map = {
    13: {
      theme: 'Emek ve kolaycılıktan kaçış gerilimi',
      note: 'Bazı ekollerde 13, yarım bırakılan işler ve disiplin dersi olarak okunur — sembolik motif, tarihsel kanıt değil.',
    },
    14: {
      theme: 'Özgürlük ve aşırılık dengesi',
      note: '14, değişim arzusu ile istikrar ihtiyacı arasındaki gerilim motifi olarak yorumlanır.',
    },
    16: {
      theme: 'Ego yıkımı ve yeniden yapılanma',
      note: '16, eski kimlik yapılarının sökülüp yeniden kurulması teması taşır; felaket kehaneti değildir.',
    },
    19: {
      theme: 'Bağımsızlık ve sorumluluk',
      note: '19, yalnız güç ile ortak alan arasında denge öğrenme motifi olarak okunur.',
    },
  };
  return map[debt] || null;
}

/**
 * Personal year theme (1–9 / masters).
 * @param {number} n
 */
export function getPersonalYearTheme(n) {
  const themes = {
    1: 'Yeni başlangıçlar, tohum ekme, kişisel yön belirleme.',
    2: 'Sabır, ortaklık, yavaş ilerleme ve ilişki düzeni.',
    3: 'İfade, sosyal genişleme, yaratıcı çıktı.',
    4: 'Temel atma, düzen, emek ve somut yapı.',
    5: 'Değişim, hareket, sürpriz ve esneklik.',
    6: 'Sorumluluk, aile/ilişki, bakım ve denge.',
    7: 'İçgözlem, öğrenme, sadeleşme.',
    8: 'Sonuç, güç, maddi/yapısal hasat.',
    9: 'Tamamlama, bırakma, döngü kapatma.',
    11: 'Sezgisel uyanış ve hassas ilham yılı (11/2).',
    22: 'Büyük ölçekli yapı ve vizyon yılı (22/4).',
  };
  return themes[n] || 'Dönemsel titreşim aktif.';
}
