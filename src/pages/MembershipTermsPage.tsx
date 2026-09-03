import { Link } from 'react-router-dom';

import TrustPageShell, { LegalSectionBlock } from '../components/trust/TrustPageShell';
import { termsIntro, termsSections } from '../data/trust-content';

export default function MembershipTermsPage() {
  return (
    <TrustPageShell eyebrow="Üyelik Sözleşmesi" title="Üyelik Sözleşmesi ve Kullanım Şartları" dek={termsIntro}>
      <p className="-mt-4 text-[12.5px] leading-6 text-[#7c8492]">
        Bu hizmeti işleten operatörün resmi kimlik bilgileri{' '}
        <Link to="/gizlilik#operator" className="text-[#c9b37a] underline-offset-4 hover:underline">
          Gizlilik / KVKK
        </Link>{' '}
        sayfasında yayınlanır.
      </p>
      {termsSections.map((section) => (
        <LegalSectionBlock key={section.id} section={section} />
      ))}
    </TrustPageShell>
  );
}
