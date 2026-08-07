import type { PersonalAnalysisEnvelope } from '../../types/personal-analysis';
import { emptyResultUserCopy } from '../../utils/archive-result-contract';
import { formatAnalysisSections, statusPresentation } from '../../utils/result-formatter';

interface ResultRendererProps {
  title: string;
  envelope: PersonalAnalysisEnvelope;
}

export default function ResultRenderer({ title, envelope }: ResultRendererProps) {
  const status = statusPresentation(envelope.status);
  const sections = formatAnalysisSections(envelope);
  const emptyReason =
    envelope.status === 'insufficient_data'
      ? 'insufficient_data'
      : envelope.status === 'reject'
        ? 'reject'
        : 'empty_synthesis';
  const emptyCopy = sections.length === 0 ? emptyResultUserCopy(emptyReason) : null;

  return (
    <article className="space-y-8 print:text-black">
      <header className="space-y-3 border-b border-white/10 pb-6 print:border-black/20">
        <p className="text-xs uppercase tracking-[0.22em] text-[#c9b37a]/70">Analiz Sonucu</p>
        <h1 className="font-display text-3xl leading-tight text-[#e8ecf2] md:text-4xl">{title}</h1>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${
            status.tone === 'success'
              ? 'bg-emerald-500/10 text-emerald-300'
              : status.tone === 'danger'
                ? 'bg-red-500/10 text-red-300'
                : 'bg-amber-500/10 text-amber-300'
          }`}
        >
          {status.label}
        </span>
      </header>

      {emptyCopy ? (
        <div
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed"
          role="status"
        >
          <p className="font-display text-lg text-[#e8ecf2]/92">{emptyCopy.title}</p>
          <p className="mt-2 text-[#e8ecf2]/68">{emptyCopy.body}</p>
          <p className="mt-3 text-xs text-[#c9b37a]/75">{emptyCopy.actionHint}</p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.id} className="space-y-3 print:break-inside-avoid">
            <h2 className="font-display text-xl text-[#e8ecf2]/92">{section.title}</h2>
            <div className="whitespace-pre-wrap text-sm leading-7 text-[#e8ecf2]/72">
              {section.content}
            </div>
          </section>
        ))
      )}
    </article>
  );
}
