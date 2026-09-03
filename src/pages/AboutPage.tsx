import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import { atlasManifesto } from '../data/landing-content';

/** Old anchor ids that used to hold inline legal text — now redirect to the dedicated pages. */
const LEGACY_ANCHOR_REDIRECT: Record<string, string> = {
  gizlilik: '/gizlilik',
  sartlar: '/uyelik-sozlesmesi',
  iletisim: '/iletisim',
};

export default function AboutPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    // These anchors used to hold inline privacy/terms/contact text. That
    // content now lives on dedicated pages (single source of truth) — old
    // links/bookmarks still work, just redirected instead of duplicated.
    const redirectTo = LEGACY_ANCHOR_REDIRECT[id];
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.hash, navigate]);

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

        <section className="mt-16 scroll-mt-28 border-t border-white/8 pt-10">
          <h2 className="font-brand text-2xl font-semibold text-[#e8ecf2]">Yasal ve destek</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#e8ecf2]/62">
            Gizlilik, üyelik şartları, iade/iptal, sık sorulan sorular, destek ve iletişim artık kendi
            sayfalarında yer alır — tek kaynaktan güncel tutulur.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link to="/gizlilik" className="site-focus text-[#c9b37a] underline-offset-4 hover:underline">
                Gizlilik / KVKK
              </Link>
            </li>
            <li>
              <Link
                to="/uyelik-sozlesmesi"
                className="site-focus text-[#c9b37a] underline-offset-4 hover:underline"
              >
                Üyelik Sözleşmesi
              </Link>
            </li>
            <li>
              <Link to="/iade-iptal" className="site-focus text-[#c9b37a] underline-offset-4 hover:underline">
                İade ve İptal
              </Link>
            </li>
            <li>
              <Link to="/sss" className="site-focus text-[#c9b37a] underline-offset-4 hover:underline">
                SSS
              </Link>
            </li>
            <li>
              <Link to="/destek" className="site-focus text-[#9aa3ae] underline-offset-4 hover:underline">
                Destek
              </Link>
            </li>
            <li>
              <Link to="/iletisim" className="site-focus text-[#9aa3ae] underline-offset-4 hover:underline">
                İletişim
              </Link>
            </li>
          </ul>
        </section>
      </main>
    </CosmicShell>
  );
}
