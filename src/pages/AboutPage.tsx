import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';

export default function AboutPage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.hash]);

  return (
    <CosmicShell>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
          Hakkında
        </p>
        <h1 className="mt-4 font-display text-[clamp(1.85rem,4vw,2.6rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]">
          Atlas nedir?
        </h1>

        <div className="mt-10 space-y-6 text-sm leading-8 text-[#e8ecf2]/68 md:text-base">
          <p className="font-display text-xl text-[#e8ecf2]/88">Atlas yalnızca cevap üretmez.</p>
          <p>
            Bilimsel ve sembolik sistemleri yan yana getirerek tekrar eden yapıları karşılaştırır.
            Amacı geleceği kesin biçimde söylemek değil; daha önce görünmeyen örüntüyü görünür
            kılmaktır.
          </p>
          <p>
            Cosmicsimya arayüzü Atlas’a erişim sağlar: kişisel analiz, arşiv, sembolik sentez ve
            hafıza destekli sohbet — hepsi aynı güvenilir oturum ve gizlilik modeline bağlıdır.
          </p>
          <p className="text-[#e8ecf2]/45">
            Atlas kesin kehanet sunmaz; sistemleri olasılık ve farkındalık diliyle ele alır.
          </p>
        </div>

        <section id="gizlilik" className="mt-16 scroll-mt-28 border-t border-white/8 pt-10">
          <h2 className="font-brand text-2xl font-semibold text-[#e8ecf2]">Gizlilik</h2>
          <p className="mt-4 text-sm leading-7 text-[#e8ecf2]/62">
            Oturum çerezleri HttpOnly olarak saklanır. Şifreler tarayıcıda tutulmaz. Analiz
            kayıtları hesabınıza bağlıdır; üçüncü taraflarla pazarlama amaçlı paylaşılmaz.
            Ürün geliştirme sırasında veri saklama politikası genişletilebilir — güncel özet bu
            sayfada yer alır.
          </p>
        </section>

        <section id="sartlar" className="mt-12 scroll-mt-28 border-t border-white/8 pt-10">
          <h2 className="font-brand text-2xl font-semibold text-[#e8ecf2]">Kullanım şartları</h2>
          <p className="mt-4 text-sm leading-7 text-[#e8ecf2]/62">
            Atlas bir karar destek ve anlamlandırma aracıdır; tıbbi, hukuki veya finansal tavsiye
            değildir. Kullanıcı kendi yargı ve sorumluluğuyla hareket eder. Hizmet kesintileri veya
            model hataları mümkün olabilir; kritik kararlarda bağımsız doğrulama gerekir.
          </p>
        </section>

        <section id="iletisim" className="mt-12 scroll-mt-28 border-t border-white/8 pt-10">
          <h2 className="font-brand text-2xl font-semibold text-[#e8ecf2]">İletişim</h2>
          <p className="mt-4 text-sm leading-7 text-[#e8ecf2]/62">
            Kurucu ve ürün soruları için Cosmicsimya üzerinden iletişime geçebilirsiniz. Destek
            kanalları ürün olgunlaştıkça bu bölümde güncellenir.
          </p>
        </section>
      </main>
    </CosmicShell>
  );
}
