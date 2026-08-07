import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import { atlasManifesto, socialLinks } from '../data/landing-content';

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
          {atlasManifesto.title}
        </h1>

        <div className="mt-10 space-y-8 text-sm leading-8 text-[#e8ecf2]/68 md:text-base">
          <p className="whitespace-pre-line font-display text-[clamp(1.35rem,3vw,1.85rem)] leading-[1.35] text-[#e8ecf2]/92">
            {atlasManifesto.lead}
          </p>
          {atlasManifesto.sections.map((section) => (
            <p key={section.body}>{section.body}</p>
          ))}
          <p className="border-t border-white/8 pt-8 text-[#e8ecf2]/45">
            Atlas kesin kehanet sunmaz. Çıkarım ile veriyi ayırır; dayanak güçlendikçe yorumu
            güçlendirir — ama bilmediğini bilmiş gibi sunmaz.
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
            Kurucu ve ürün soruları için Cosmic Simya kanallarından bize ulaşabilirsiniz.
          </p>
          <ul className="mt-5 flex flex-wrap gap-3 text-sm">
            <li>
              <a
                href={socialLinks.instagram.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={socialLinks.instagram.ariaLabel}
                className="site-focus text-[#c9b37a] underline-offset-4 hover:underline"
              >
                {socialLinks.instagram.label}
              </a>
            </li>
            <li>
              <a
                href={socialLinks.telegram.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={socialLinks.telegram.ariaLabel}
                className="site-focus text-[#c9b37a] underline-offset-4 hover:underline"
              >
                {socialLinks.telegram.label}
              </a>
            </li>
          </ul>
        </section>
      </main>
    </CosmicShell>
  );
}
