import { useEffect, useState } from 'react';

import TrustPageShell, { LegalSectionBlock, OperatorMissingNotice } from '../components/trust/TrustPageShell';
import { privacyIntro, privacySections } from '../data/trust-content';
import { fetchOperatorConfig, type AtlasOperatorConfig } from '../services/atlas-operator-config';

export default function PrivacyPolicyPage() {
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
    <TrustPageShell eyebrow="Gizlilik" title="Gizlilik ve KVKK" dek={privacyIntro}>
      {privacySections.map((section) =>
        section.id === 'operator' ? (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-28 border-t border-white/[0.07] pt-8 first:border-t-0 first:pt-0"
          >
            <h2 className="font-brand text-xl font-semibold text-[#e8ecf2] sm:text-2xl">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-[#9aa3b2]">
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {operator ? (
              operator.legalOperatorName ? (
                <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm text-[#c7cad0] sm:grid-cols-[auto_1fr]">
                  <dt className="text-[#7c8492]">Operatör</dt>
                  <dd>{operator.legalOperatorName}</dd>
                  {operator.legalOperatorAddress ? (
                    <>
                      <dt className="text-[#7c8492]">Adres</dt>
                      <dd>{operator.legalOperatorAddress}</dd>
                    </>
                  ) : null}
                  {operator.legalTaxId ? (
                    <>
                      <dt className="text-[#7c8492]">Vergi bilgisi</dt>
                      <dd>{operator.legalTaxId}</dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <OperatorMissingNotice legalOperatorName={operator.legalOperatorName} />
              )
            ) : null}
          </section>
        ) : (
          <LegalSectionBlock key={section.id} section={section} />
        ),
      )}
    </TrustPageShell>
  );
}
