/**
 * Shared layout + primitives for the trust/legal/support surfaces
 * (Privacy, Membership Terms, Refund/Cancellation, FAQ, Contact, Support).
 * Reuses the existing ATLAS visual system (CosmicShell, gold accent,
 * font-display headings) — no new design language.
 */

import type { ReactNode } from 'react';

import CosmicShell from '../cosmic/CosmicShell';
import type { LegalSection } from '../../data/trust-content';

export default function TrustPageShell({
  eyebrow,
  title,
  dek,
  children,
}: {
  eyebrow: string;
  title: string;
  dek?: string;
  children: ReactNode;
}) {
  return (
    <CosmicShell>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">{eyebrow}</p>
        <h1 className="mt-4 font-display text-[clamp(1.85rem,4vw,2.6rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]">
          {title}
        </h1>
        {dek ? (
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#9aa3b2] md:text-base">{dek}</p>
        ) : null}
        <div className="mt-12 space-y-9">{children}</div>
      </main>
    </CosmicShell>
  );
}

type NoticeKind = 'legal' | 'business' | 'operator';

const NOTICE_LABEL: Record<NoticeKind, string> = {
  legal: 'Hukuki inceleme gerekli',
  business: 'İşletme kararı bekleniyor',
  operator: 'Operatör bilgisi eksik',
};

export function DraftNotice({ kind = 'legal', children }: { kind?: NoticeKind; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-[#c9b37a]/25 bg-[#c9b37a]/[0.06] px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#d3c08a]">
        {NOTICE_LABEL[kind]}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-6 text-[#c7cad0]">{children}</p>
    </div>
  );
}

export function LegalSectionBlock({ section }: { section: LegalSection }) {
  return (
    <section id={section.id} className="scroll-mt-28 border-t border-white/[0.07] pt-8 first:border-t-0 first:pt-0">
      <h2 className="font-brand text-xl font-semibold text-[#e8ecf2] sm:text-2xl">{section.title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[#9aa3b2]">
        {section.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {section.list ? (
        <ul className="mt-4 space-y-2.5 text-sm leading-6 text-[#9aa3b2]">
          {section.list.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[#c9b37a]/60" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {section.needsLegalReview ? (
        <DraftNotice kind="legal">
          Bu bölümdeki ifadeler taslak niteliğindedir ve yürürlüğe girmeden önce hukuki inceleme gerektirir.
        </DraftNotice>
      ) : null}
      {section.needsBusinessDecision ? (
        <DraftNotice kind="business">
          Bu bölümdeki davranış henüz işletme tarafından nihai karara bağlanmamıştır.
        </DraftNotice>
      ) : null}
    </section>
  );
}

/** Renders only when the operator has not configured a legal entity name. */
export function OperatorMissingNotice({ legalOperatorName }: { legalOperatorName: string | null }) {
  if (legalOperatorName) return null;
  return (
    <DraftNotice kind="operator">
      Bu hizmeti işleten tüzel kişi/işletmenin resmi unvanı, adresi ve vergi bilgileri henüz bu sayfada
      yayınlanmamıştır. Üretime geçmeden önce eklenmelidir.
    </DraftNotice>
  );
}
