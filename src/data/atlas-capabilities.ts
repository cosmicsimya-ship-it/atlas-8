/**
 * ATLAS Capability ontology — internal OS map.
 * Not a marketing catalog. Surface only via progressive discovery
 * (`capability-discovery.ts` + conversation).
 */

export type CapabilityStatus = 'live' | 'beta' | 'next';

export type Capability = {
  id: string;
  name: string;
  purpose: string;
  micro: string;
  /** Visual icon concept for designers / SVG mapping */
  iconConcept: string;
  /** What the user does */
  interaction: string;
  /** Motion when hovered / active */
  animationIdea: string;
  /** How this extends later without redesign */
  extensibility: string;
  status: CapabilityStatus;
  href?: string;
};

export type CapabilityModuleId =
  | 'understand'
  | 'think'
  | 'remember'
  | 'guide'
  | 'interact'
  | 'evolve';

export type CapabilityModule = {
  id: CapabilityModuleId;
  /** OS ring label */
  code: string;
  title: string;
  purpose: string;
  micro: string;
  iconConcept: string;
  /** Unique cool accent within the system (no gold/purple) */
  accent: string;
  accentSoft: string;
  /** Position on the neural map (desktop) */
  map: { x: number; y: number };
  capabilities: Capability[];
};

export const capabilityMapMeta = {
  /** Internal only — do not deep-link as a landing feature section */
  id: 'capability-ontology',
  hubLabel: 'ATLAS',
  hubMicro: 'Living intelligence core',
} as const;

export const capabilityModules: CapabilityModule[] = [
  {
    id: 'understand',
    code: 'UNDERSTAND',
    title: 'Anlama',
    purpose: 'Ham veriyi ve sembolü okunabilir yapıya çevirir.',
    micro: 'Katmanları okur. Gürültüyü ayırır.',
    iconConcept: 'Stacked translucent planes coming into register',
    accent: '#7EB6FF',
    accentSoft: 'rgba(126, 182, 255, 0.14)',
    map: { x: 18, y: 22 },
    capabilities: [
      {
        id: 'pattern-analysis',
        name: 'Örüntü Analizi',
        purpose: 'Tekrar eden yapıları ve sapmaları görünür kılar.',
        micro: 'Ne tekrar ediyor? Ne kırılıyor?',
        iconConcept: 'Sparse node lattice with one highlighted path',
        interaction: 'Soru sor veya analiz aç — örüntüler katman olarak döner.',
        animationIdea: 'Paths draw in sequence; weak noise fades.',
        extensibility: 'New pattern engines plug in as silent layers.',
        status: 'live',
      },
      {
        id: 'symbolic-intelligence',
        name: 'Sembolik Zekâ',
        purpose: 'Anlam katmanlarını tek okumada birleştirir.',
        micro: 'Sembolü araç değil, sinyal olarak okur.',
        iconConcept: 'Nested rings with a soft seam of light',
        interaction: 'Sembolik Analiz veya sohbet ile tetiklenir.',
        animationIdea: 'Rings drift then lock; cyan seam on insight.',
        extensibility: 'Additional symbolic corpora attach behind one UX.',
        status: 'live',
        href: '/analysis/symbolic',
      },
      {
        id: 'numerological-mapping',
        name: 'Numerolojik Haritalama',
        purpose: 'Sayısal gelenekleri ölçülebilir haritaya bağlar.',
        micro: 'Sayı → yapı. Kehanet değil, çerçeve.',
        iconConcept: 'Monospace digits dissolving into a clean grid',
        interaction: 'Günlük / kişisel bağlamda otomatik katman.',
        animationIdea: 'Digits settle into fixed cells.',
        extensibility: 'New number systems register as map projections.',
        status: 'beta',
      },
      {
        id: 'astrological-context',
        name: 'Astrolojik Bağlam',
        purpose: 'Gökyüzü zamanını bağlamsal çerçeve olarak sunar.',
        micro: 'Zamanın atmosferini gösterir.',
        iconConcept: 'Thin orbital arcs, no zodiac ornament',
        interaction: 'Günlük analiz ve sohbet bağlamında.',
        animationIdea: 'Slow orbital drift; never spins like a loader.',
        extensibility: 'Ephemeris modules swap without UI redesign.',
        status: 'beta',
      },
      {
        id: 'dream-interpretation',
        name: 'Rüya Analizi',
        purpose: 'Rüyayı sembol, duygu ve olay örgüsü katmanlarında okur.',
        micro: 'Kehanet değil; çok katmanlı sembolik anlamlandırma.',
        iconConcept: 'Soft night horizon with layered translucent motifs',
        interaction: 'Rüyayı anlat — Atlas katmanlı yorum döner.',
        animationIdea: 'Motifs surface from depth then settle into layers.',
        extensibility: 'Symbol corpora and classical schools version independently.',
        status: 'live',
      },
    ],
  },
  {
    id: 'think',
    code: 'THINK',
    title: 'Düşünme',
    purpose: 'Katmanları birlikte gerekçelendirir; tek cevap dayatmaz.',
    micro: 'Çok katmanlı muhakeme.',
    iconConcept: 'Branching light paths converging to a calm center',
    accent: '#4F7CFF',
    accentSoft: 'rgba(79, 124, 255, 0.14)',
    map: { x: 82, y: 22 },
    capabilities: [
      {
        id: 'multi-layer-reasoning',
        name: 'Çok Katmanlı Muhakeme',
        purpose: 'Ayrı sistemleri karıştırmadan yan yana okur.',
        micro: 'Her katman kendi yönteminde kalır.',
        iconConcept: 'Parallel glass sheets with shared highlight band',
        interaction: 'Sohbet veya sentez isteklerinde devreye girer.',
        animationIdea: 'Sheets stagger then share one highlight.',
        extensibility: 'New layers register into the same composer.',
        status: 'live',
        href: '/atlas',
      },
      {
        id: 'hidden-pattern-discovery',
        name: 'Gizli Örüntü Keşfi',
        purpose: 'İlk bakışta görünmeyen ortak yapıları işaretler.',
        micro: 'Görünmeyeni görünür kılar.',
        iconConcept: 'Faint secondary path becoming solid',
        interaction: 'Analiz sonrası “ortak örüntü” yüzeyinde.',
        animationIdea: 'Secondary path fades in after primary.',
        extensibility: 'Detectors added as optional insight plugins.',
        status: 'beta',
      },
      {
        id: 'archetype-detection',
        name: 'Arketip Algılama',
        purpose: 'Tekrarlayan rol / tema yapılarını nazikçe adlandırır.',
        micro: 'Etiket değil, düşünme çerçevesi.',
        iconConcept: 'Soft silhouette outline dissolving into geometry',
        interaction: 'Sembolik ve kişisel okumalarda.',
        animationIdea: 'Outline resolves into simple geometry.',
        extensibility: 'Archetype libraries versioned independently.',
        status: 'next',
      },
      {
        id: 'timeline-analysis',
        name: 'Zaman Çizgisi Analizi',
        purpose: 'Olay ve temaları zamansal sıraya oturtur.',
        micro: 'Ne ne zaman yoğunlaşıyor?',
        iconConcept: 'Horizontal pulse ticks with one active window',
        interaction: 'Arşiv ve uzun sohbet bağlamında.',
        animationIdea: 'Playhead glides; active window breathes.',
        extensibility: 'Arbitrary event sources pin onto the same rail.',
        status: 'next',
      },
    ],
  },
  {
    id: 'remember',
    code: 'REMEMBER',
    title: 'Hatırlama',
    purpose: 'Süreklilik sağlar; her oturumu sıfırdan başlatmaz.',
    micro: 'Bağlam birikir. Gürültü değil.',
    iconConcept: 'Quiet archival stacks with one living pulse',
    accent: '#5EC8D9',
    accentSoft: 'rgba(94, 200, 217, 0.14)',
    map: { x: 12, y: 55 },
    capabilities: [
      {
        id: 'memory',
        name: 'Bellek',
        purpose: 'Önemli tercih ve gerçekleri güvenli tutar.',
        micro: 'Seni yeniden tanımayı öğrenir.',
        iconConcept: 'Soft capsule with a steady status pulse',
        interaction: 'Oturum ve hesap bağlamında otomatik.',
        animationIdea: 'Pulse only when memory is written/read.',
        extensibility: 'Memory scopes (session/user) without new chrome.',
        status: 'live',
        href: '/atlas',
      },
      {
        id: 'personal-archive',
        name: 'Kişisel Arşiv',
        purpose: 'Analiz ve konuşmaları geri açılabilir kılar.',
        micro: 'Geçmişe dön. İzi kaybetme.',
        iconConcept: 'Thin index rails, mono timestamps',
        interaction: 'Arşiv yüzeyinden reopen.',
        animationIdea: 'List items rise from depth on open.',
        extensibility: 'New artifact types share the same archive row.',
        status: 'live',
        href: '/archive',
      },
      {
        id: 'conversation-context',
        name: 'Konuşma Bağlamı',
        purpose: 'Aktif diyaloğu tutarlı sürdürür.',
        micro: 'Nerede kaldığını bilir.',
        iconConcept: 'Linked message nodes in a calm chain',
        interaction: 'Chat workspace içinde sürekli.',
        animationIdea: 'Context chip soft-glows when referenced.',
        extensibility: 'Channel adapters inject into same context bus.',
        status: 'live',
        href: '/atlas',
      },
      {
        id: 'growth-tracking',
        name: 'Gelişim İzleme',
        purpose: 'Uzun vadeli değişim ve temaları izler.',
        micro: 'Bugün ile geçen ayı yan yana koyar.',
        iconConcept: 'Sparse trend spine, not a noisy chart',
        interaction: 'Arşiv / kişisel yüzeylerde.',
        animationIdea: 'Spine draws forward on hover.',
        extensibility: 'Metrics opt-in without redesigning memory.',
        status: 'next',
      },
    ],
  },
  {
    id: 'guide',
    code: 'GUIDE',
    title: 'Rehberlik',
    purpose: 'Kararı kullanıcıda bırakarak görüş alanını netleştirir.',
    micro: 'Dayatma yok. Netlik var.',
    iconConcept: 'Compass ring with an open center (no needle force)',
    accent: '#6B9FB8',
    accentSoft: 'rgba(107, 159, 184, 0.14)',
    map: { x: 88, y: 55 },
    capabilities: [
      {
        id: 'decision-support',
        name: 'Karar Desteği',
        purpose: 'Seçenekleri ve gerilimleri görünür kılar.',
        micro: 'Ne ile ne geriliyor?',
        iconConcept: 'Two balanced glass panes, seam between',
        interaction: 'Sohbette karar / ikilem ifadelerinde.',
        animationIdea: 'Panes equalize; seam softens.',
        extensibility: 'Decision frames become reusable templates.',
        status: 'live',
        href: '/atlas',
      },
      {
        id: 'reflection',
        name: 'Yansıtma',
        purpose: 'Düşünme alanı açar; acele cevap vermez.',
        micro: 'Soru ile derinleştirir.',
        iconConcept: 'Soft mirror plane with faint return wave',
        interaction: 'Sembolik sonuç ve sohbet yansıtma blokları.',
        animationIdea: 'Return wave on pause — calm, not chatty.',
        extensibility: 'Reflection prompts versioned by intent.',
        status: 'live',
      },
      {
        id: 'insight-generation',
        name: 'İçgörü Üretimi',
        purpose: 'Katmanlardan sakin, eyleme yakın içgörü çıkarır.',
        micro: 'Kısa. Keskin. Abartısız.',
        iconConcept: 'Single seam flash on register lock',
        interaction: 'Analiz sentezi ve meta-sentez modları.',
        animationIdea: 'Seam flash once; then stillness.',
        extensibility: 'Insight styles selectable without new layout.',
        status: 'beta',
      },
      {
        id: 'personalized-recommendations',
        name: 'Kişisel Öneriler',
        purpose: 'Bağlama uygun sonraki adımları önerir.',
        micro: 'Emir değil, seçenek.',
        iconConcept: 'Three quiet chips; one gently brighter',
        interaction: 'Sonuç sonu ve sohbet kapanışında.',
        animationIdea: 'Chips stagger in; no bounce.',
        extensibility: 'Recommendation policies plug in per surface.',
        status: 'next',
      },
    ],
  },
  {
    id: 'interact',
    code: 'INTERACT',
    title: 'Etkileşim',
    purpose: 'Aynı zekâyı her kanalda aynı dilde sunar.',
    micro: 'Tek varlık. Çok yüzey.',
    iconConcept: 'Multi-channel nodes orbiting one core',
    accent: '#3B82F6',
    accentSoft: 'rgba(59, 130, 246, 0.16)',
    map: { x: 32, y: 86 },
    capabilities: [
      {
        id: 'voice-conversation',
        name: 'Sesli Konuşma',
        purpose: 'Eller serbest, Core-öne çıkan etkileşim.',
        micro: 'Konuş. Dinle. Duraklat.',
        iconConcept: 'Core halo expanding on listen',
        interaction: 'Voice state surface (yol haritası).',
        animationIdea: 'Halo expands while listening; contracts on mute.',
        extensibility: 'STT/TTS providers swap behind VoiceState.',
        status: 'next',
      },
      {
        id: 'natural-dialogue',
        name: 'Doğal Diyalog',
        purpose: 'Web üzerinde birincil konuşma alanı.',
        micro: 'Asistan balonu değil — düşünme alanı.',
        iconConcept: 'Wide soft message plane, not SMS bubbles',
        interaction: 'Atlas sohbet workspace.',
        animationIdea: 'Messages rise 8px with calm ease.',
        extensibility: 'Modes attach as quiet captions.',
        status: 'live',
        href: '/atlas',
      },
      {
        id: 'telegram',
        name: 'Telegram',
        purpose: 'Aynı zekâyı mesaj kanalında sürdürür.',
        micro: 'Cebinde Atlas.',
        iconConcept: 'Thin channel pip into the Core',
        interaction: 'Bağlı Telegram hesabı / bot.',
        animationIdea: 'Pip pulse on inbound message.',
        extensibility: 'Other messengers share channel adapter API.',
        status: 'live',
      },
      {
        id: 'web',
        name: 'Web',
        purpose: 'Tam OS deneyimi — giriş, analiz, arşiv.',
        micro: 'Ana çalışma yüzeyi.',
        iconConcept: 'Glass viewport frame',
        interaction: 'Bu ürün yüzeyi.',
        animationIdea: 'Frame specular on route enter.',
        extensibility: 'New routes inherit shell language.',
        status: 'live',
      },
      {
        id: 'mobile',
        name: 'Mobil',
        purpose: 'Aynı dil, dokunmatik öncelikli.',
        micro: 'Aynı DNA. Farklı form.',
        iconConcept: 'Compact Core + thumb composer',
        interaction: 'Responsive web → native ileride.',
        animationIdea: 'Composer docks to thumb zone.',
        extensibility: 'Native shells consume same design tokens.',
        status: 'next',
      },
    ],
  },
  {
    id: 'evolve',
    code: 'EVOLVE',
    title: 'Gelişim',
    purpose: 'Uzun vadede seni daha iyi anlayan bir sistem olur.',
    micro: 'Sabit bot değil. Öğrenen varlık.',
    iconConcept: 'Spiral of faint rings expanding outward',
    accent: '#9AD4F0',
    accentSoft: 'rgba(154, 212, 240, 0.14)',
    map: { x: 68, y: 86 },
    capabilities: [
      {
        id: 'learns-preferences',
        name: 'Tercih Öğrenme',
        purpose: 'Üslup ve sınır tercihlerini içselleştirir.',
        micro: 'Nasıl konuşmanı istediğini öğrenir.',
        iconConcept: 'Soft dial settling to a preference mark',
        interaction: 'Kullanım + ayarlar üzerinden.',
        animationIdea: 'Dial eases to mark — no spin.',
        extensibility: 'Preference keys expand without new screens.',
        status: 'beta',
      },
      {
        id: 'adapts-responses',
        name: 'Yanıt Uyarlama',
        purpose: 'Ton ve derinliği bağlama göre ayarlar.',
        micro: 'Aynı zekâ. Uygun yoğunluk.',
        iconConcept: 'Wave amplitude gently changing',
        interaction: 'Sohbet boyunca otomatik.',
        animationIdea: 'Amplitude eases after user signal.',
        extensibility: 'Adaptation policies A/B without UI forks.',
        status: 'beta',
      },
      {
        id: 'improves-context',
        name: 'Bağlam İyileştirme',
        purpose: 'Hangi bağlama ihtiyaç duyduğunu netleştirir.',
        micro: 'Daha az tekrar. Daha net soru.',
        iconConcept: 'Fog clearing around a focal point',
        interaction: 'Uzun oturumlarda.',
        animationIdea: 'Fog opacity drops as context locks.',
        extensibility: 'Context scorers plug into memory bus.',
        status: 'next',
      },
      {
        id: 'long-term-understanding',
        name: 'Uzun Vadeli Anlayış',
        purpose: 'Zaman içinde tutarlı bir seni-modeli kurar.',
        micro: 'Seni bir oturumluk sanmaz.',
        iconConcept: 'Deep archive spine with living tip',
        interaction: 'Kimlik + arşiv + bellek birleşiminde.',
        animationIdea: 'Tip pulse; spine remains still.',
        extensibility: 'Model profiles versioned; user-exportable.',
        status: 'next',
      },
    ],
  },
];

export const capabilityStatusLabel: Record<CapabilityStatus, string> = {
  live: 'Aktif',
  beta: 'Erken erişim',
  next: 'Yakında',
};
