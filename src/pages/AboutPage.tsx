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
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [location.hash]);

  return (
    <CosmicShell>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8">
        <p className="atlas-compass-eyebrow text-[10px]">VAROLUŞ</p>

        <div className="mt-8 space-y-8 text-sm leading-8 text-[#d9dade]/68 md:text-base">
          <p className="whitespace-pre-line font-display text-[clamp(1.65rem,3.2vw,2.35rem)] leading-[1.25] tracking-[-0.02em] text-[#f0f0ee]">
            {atlasManifesto.lead}
          </p>
          {atlasManifesto.sections.map((section) => (
            <p key={section.body}>{section.body}</p>
          ))}
          <p className="border-t border-white/8 pt-8 text-[#d9dade]/45">
            Atlas kesin kehanet sunmaz. Çıkarım ile veriyi ayırır; dayanak güçlendikçe yorumu güçlendirir — ama bilmediğini bilmiş gibi sunmaz.
          </p>
        </div>

        <section id="gizlilik" className="mt-16 scroll-mt-28 border-t border-white/8 pt-10">
          <h2 className="font-brand text-2xl font-semibold text-[#ececeb]">Gizlilik</h2>
          <p className="mt-4 text-sm leading-7 text-[#d9dade]/62">
            Oturum çerezleri HttpOnly olarak saklanır. Şifreler tarayıcıda tutulmaz. Analiz kayıtları hesabınıza bağlıdır; üçüncü taraflarla pazarlama amaçlı paylaşılmaz. Ürün geliştirme sırasında veri saklama politikası genişletilebilir — güncel özet bu sayfada yer alır.
          </p>
        </section>

        <section id="sartlar" className="mt-12 scroll-mt-28 border-t border-white/8 pt-10">
          <h2 className="font-brand text-2xl font-semibold text-[#ececeb]">Kullanım şartları</h2>
          <p className="mt-4 text-sm leading-7 text-[#d9dade]/62">
            Atlas bir karar destek ve anlamlandırma aracıdır; tıbbi, hukuki veya finansal tavsiye değildir. Kullanıcı kendi yargı ve sorumluluğuyla hareket eder. Hizmet kesintileri veya model hataları mümkün olabilir; kritik kararlarda bağımsız doğrulama gerekir.
          </p>
        </section>

        <section id="iletisim" className="mt-12 scroll-mt-28 border-t border-white/8 pt-10">
          <h2 className="font-brand text-2xl font-semibold text-[#ececeb]">İletişim</h2>
          <p className="mt-4 text-sm leading-7 text-[#d9dade]/62">Marka ve ürün soruları için Cosmic Simya sosyal kanallarını kullanabilirsiniz.</p>
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[#8b8e94]">Sosyal</span>
              <a href={socialLinks.instagram.href} target="_blank" rel="noopener noreferrer" aria-label={socialLinks.instagram.ariaLabel} className="site-focus text-[#d3d4d6] underline-offset-4 hover:underline">Instagram {socialLinks.instagram.label}</a>
            </li>
            <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[#777b82]">Kanal</span>
              <a href={socialLinks.telegram.href} target="_blank" rel="noopener noreferrer" aria-label={socialLinks.telegram.ariaLabel} className="site-focus text-[#b8bbc0] underline-offset-4 hover:underline">{socialLinks.telegram.label}</a>
            </li>
          </ul>
        </section>
      </main>
    </CosmicShell>
  );
}
