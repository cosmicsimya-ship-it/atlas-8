import { Link } from 'react-router-dom';

import TrustPageShell, { LegalSectionBlock } from '../components/trust/TrustPageShell';
import { refundIntro, refundSections } from '../data/trust-content';

export default function RefundCancellationPage() {
  return (
    <TrustPageShell eyebrow="İade ve İptal" title="Yenileme, İptal ve İade" dek={refundIntro}>
      {refundSections.map((section) => (
        <LegalSectionBlock key={section.id} section={section} />
      ))}

      <section className="scroll-mt-28 border-t border-white/[0.07] pt-8">
        <h2 className="font-brand text-xl font-semibold text-[#e8ecf2] sm:text-2xl">
          Bir iade talebi veya faturalandırma sorunu mu var?
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9aa3b2]">
          Destek sayfasındaki "Üyelik / ödeme" konu başlığından bize ulaş. Talebini işleme almadan önce
          hesabına ait ödeme kaydını gözden geçirebilmemiz için hesabına bağlı e-posta adresini kullan.
        </p>
        <Link
          to="/destek"
          className="atlas-focus mt-5 inline-flex items-center gap-2 rounded-lg border border-[#d5c184]/35 bg-[#d5c184]/10 px-4 py-2.5 text-sm font-medium text-[#f2ead4] transition hover:bg-[#d5c184]/16"
        >
          Destek sayfasına git
        </Link>
      </section>
    </TrustPageShell>
  );
}
