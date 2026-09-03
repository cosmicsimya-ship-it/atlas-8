import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, LifeBuoy, Mail } from 'lucide-react';

import TrustPageShell, { DraftNotice } from '../components/trust/TrustPageShell';
import ContactForm from '../components/trust/ContactForm';
import { CONTACT_TOPICS } from '../data/trust-content';
import { fetchOperatorConfig, type AtlasOperatorConfig } from '../services/atlas-operator-config';

const BILLING_FIRST_TOPICS = [
  CONTACT_TOPICS.find((t) => t.value === 'billing')!,
  ...CONTACT_TOPICS.filter((t) => t.value !== 'billing'),
];

export default function SupportPage() {
  const [operator, setOperator] = useState<AtlasOperatorConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOperatorConfig().then((cfg) => {
      if (!cancelled) setOperator(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TrustPageShell
      eyebrow="Destek"
      title="Üyelik ve ödeme desteği"
      dek="Lara Prime üyeliğin, faturalandırman veya hesabınla ilgili bir sorun mu var? Bu sayfa doğrudan üyelik/ödeme desteğine gider."
    >
      <section className="border-t border-white/[0.07] pt-8 first:border-t-0 first:pt-0">
        <div className="flex items-center gap-2.5 text-[#d3c08a]">
          <CreditCard size={16} aria-hidden="true" />
          <p className="text-[11px] font-medium uppercase tracking-[0.2em]">Üyelik / ödeme desteği</p>
        </div>
        {operator?.billingSupportEmail ? (
          <a
            href={`mailto:${operator.billingSupportEmail}`}
            className="atlas-focus mt-4 inline-flex items-center gap-2.5 rounded-lg border border-white/[0.1] bg-white/[0.02] px-4 py-3 text-sm text-[#e5e8ec] transition hover:border-[#c9b37a]/30 hover:bg-[#c9b37a]/[0.04]"
          >
            <Mail size={15} className="text-[#c9b37a]/80" aria-hidden="true" />
            {operator.billingSupportEmail}
          </a>
        ) : operator ? (
          <DraftNotice kind="operator">
            Üyelik/ödeme desteği için ayrılmış bir e-posta adresi henüz yapılandırılmadı. Bu sırada
            aşağıdaki formu "Üyelik / ödeme" konusuyla kullanabilirsin.
          </DraftNotice>
        ) : null}
        {operator?.supportResponseNote ? (
          <p className="mt-4 text-[12.5px] leading-6 text-[#7c8492]">{operator.supportResponseNote}</p>
        ) : null}
      </section>

      <section className="border-t border-white/[0.07] pt-8">
        <div className="flex items-center gap-2.5 text-[#8b93a3]">
          <LifeBuoy size={16} aria-hidden="true" />
          <p className="text-[11px] font-medium uppercase tracking-[0.2em]">Faturalandırma sorunu nasıl işlenir?</p>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9aa3b2]">
          Beklenmedik bir tahsilat, başarısız ödeme veya yanlış tutar gördüysen aşağıdaki formu "Üyelik /
          ödeme" konusuyla gönder. Talepler gönderim sırasına göre incelenir. Yenileme, iptal ve iade
          koşullarının tam çerçevesi için{' '}
          <Link to="/iade-iptal" className="text-[#c9b37a] underline-offset-4 hover:underline">
            İade ve İptal
          </Link>{' '}
          sayfasına bakabilirsin.
        </p>
      </section>

      <section className="border-t border-white/[0.07] pt-8">
        <h2 className="font-brand text-xl font-semibold text-[#e8ecf2] sm:text-2xl">Destek formu</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9aa3b2]">
          Form sunucuda güvenli biçimde kaydedilir ve destek ekibi tarafından incelenir.
        </p>
        <div className="mt-6">
          <ContactForm defaultTopic="billing" topics={BILLING_FIRST_TOPICS} />
        </div>
      </section>

      <p className="text-[13px] leading-6 text-[#7c8492]">
        Genel ürün soruların için{' '}
        <Link to="/iletisim" className="text-[#c9b37a] underline-offset-4 hover:underline">
          İletişim
        </Link>{' '}
        sayfasını, sık sorulan sorular için{' '}
        <Link to="/sss" className="text-[#c9b37a] underline-offset-4 hover:underline">
          SSS
        </Link>{' '}
        sayfasını kullanabilirsin.
      </p>
    </TrustPageShell>
  );
}
