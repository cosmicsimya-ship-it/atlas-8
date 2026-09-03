import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

import TrustPageShell from '../components/trust/TrustPageShell';
import { faqItems } from '../data/trust-content';

export default function FAQPage() {
  return (
    <TrustPageShell
      eyebrow="SSS"
      title="Sıkça Sorulan Sorular"
      dek="Lara Prime, üyelik, faturalandırma ve Atlas hakkında en sık gelen sorular. Aradığını bulamazsan İletişim veya Destek sayfasından bize ulaşabilirsin."
    >
      <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
        {faqItems.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="atlas-focus flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-medium leading-6 text-[#e5e8ec] marker:content-none">
              <span>{item.q}</span>
              <ChevronDown
                size={16}
                className="mt-0.5 flex-none text-[#8b93a3] transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-7 text-[#929aa7]">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="text-[13px] leading-6 text-[#7c8492]">
        Cevabını bulamadığın bir soru mu var?{' '}
        <Link to="/iletisim" className="text-[#c9b37a] underline-offset-4 hover:underline">
          İletişim
        </Link>{' '}
        veya{' '}
        <Link to="/destek" className="text-[#c9b37a] underline-offset-4 hover:underline">
          Destek
        </Link>{' '}
        sayfasından bize yazabilirsin.
      </p>
    </TrustPageShell>
  );
}
