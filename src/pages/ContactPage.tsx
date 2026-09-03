import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

import TrustPageShell, { DraftNotice } from '../components/trust/TrustPageShell';
import ContactForm from '../components/trust/ContactForm';
import { socialLinks } from '../data/landing-content';
import { fetchOperatorConfig, type AtlasOperatorConfig } from '../services/atlas-operator-config';

export default function ContactPage() {
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
      eyebrow="İletişim"
      title="Bize ulaş"
      dek="Genel sorular, ürün soruları ve geri bildirimler için. Üyelik veya ödeme ile ilgili bir sorunun varsa Destek sayfası daha hızlı sonuç verir."
    >
      <section className="border-t border-white/[0.07] pt-8 first:border-t-0 first:pt-0">
        <h2 className="font-brand text-xl font-semibold text-[#e8ecf2] sm:text-2xl">E-posta ile ulaş</h2>
        {operator?.supportEmail ? (
          <a
            href={`mailto:${operator.supportEmail}`}
            className="atlas-focus mt-4 inline-flex items-center gap-2.5 rounded-lg border border-white/[0.1] bg-white/[0.02] px-4 py-3 text-sm text-[#e5e8ec] transition hover:border-[#c9b37a]/30 hover:bg-[#c9b37a]/[0.04]"
          >
            <Mail size={15} className="text-[#c9b37a]/80" aria-hidden="true" />
            {operator.supportEmail}
          </a>
        ) : operator ? (
          <DraftNotice kind="operator">
            Genel iletişim için ayrılmış bir e-posta adresi henüz yapılandırılmadı. Bu sırada aşağıdaki
            formu kullanabilirsin — mesajın güvenli biçimde kaydedilir.
          </DraftNotice>
        ) : null}
        {operator?.supportResponseNote ? (
          <p className="mt-4 text-[12.5px] leading-6 text-[#7c8492]">{operator.supportResponseNote}</p>
        ) : null}
      </section>

      <section className="border-t border-white/[0.07] pt-8">
        <h2 className="font-brand text-xl font-semibold text-[#e8ecf2] sm:text-2xl">Form ile yaz</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9aa3b2]">
          Aşağıdaki form sunucuda güvenli biçimde kaydedilir ve destek ekibi tarafından incelenir.
        </p>
        <div className="mt-6">
          <ContactForm defaultTopic="general" />
        </div>
      </section>

      <section className="border-t border-white/[0.07] pt-8">
        <h2 className="font-brand text-xl font-semibold text-[#e8ecf2] sm:text-2xl">Sosyal kanallar</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9aa3b2]">
          Instagram ve Telegram, marka ve topluluk kanallarımızdır — hesap, ödeme veya gizlilik
          talepleri için birincil destek yolu değildir. Bu tür talepler için lütfen yukarıdaki e-posta
          veya form yolunu kullan.
        </p>
        <ul className="mt-5 flex flex-wrap gap-3 text-sm">
          <li>
            <a
              href={socialLinks.instagram.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={socialLinks.instagram.ariaLabel}
              className="site-focus inline-flex items-center gap-2 rounded-lg border border-white/[0.1] px-3.5 py-2 text-[#c7cad0] transition hover:border-white/20 hover:text-[#e8ecf2]"
            >
              Instagram
            </a>
          </li>
          <li>
            <a
              href={socialLinks.telegram.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={socialLinks.telegram.ariaLabel}
              className="site-focus inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3.5 py-2 text-[#9aa3b2] transition hover:border-white/16 hover:text-[#c7cad0]"
            >
              Telegram
            </a>
          </li>
        </ul>
      </section>

      <p className="text-[13px] leading-6 text-[#7c8492]">
        Üyelik yenileme, iptal veya faturalandırma sorunları için{' '}
        <Link to="/destek" className="text-[#c9b37a] underline-offset-4 hover:underline">
          Destek
        </Link>{' '}
        sayfasına bakabilirsin.
      </p>
    </TrustPageShell>
  );
}
