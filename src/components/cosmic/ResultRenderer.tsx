import type { PersonalAnalysisEnvelope } from '../../types/personal-analysis';
import { formatAnalysisSections, statusPresentation } from '../../utils/result-formatter';

interface ResultRendererProps {
  title: string;
  envelope: PersonalAnalysisEnvelope;
}

export default function ResultRenderer({ title, envelope }: ResultRendererProps) {
  const status = statusPresentation(envelope.status);
  const sections = formatAnalysisSections(envelope);

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

      {envelope.status !== 'complete' && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm leading-relaxed text-amber-100/85">
          {envelope.status === 'insufficient_data'
            ? 'Analiz için yeterli veri bulunamadı. Eksik alanları tamamlayıp tekrar deneyebilirsin.'
            : 'Bu istek mevcut verilerle işlenemedi. Niyetini netleştirmek veya koordinatları gözden geçirmek faydalı olabilir.'}
        </div>
      )}

      {sections.length === 0 ? (
        <p className="text-[#e8ecf2]/55">
          Bu yanıt için görüntülenecek sentez bölümü bulunamadı. Ham veri kaydedildi.
        </p>
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
