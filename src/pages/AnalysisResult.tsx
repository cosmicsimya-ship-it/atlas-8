import { Copy, MessageCircle, Plus, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import ResultRenderer from '../components/cosmic/ResultRenderer';
import { getArchiveRecord } from '../services/analysis-archive';
import type { AnalysisArchiveRecord } from '../services/analysis-archive';
import { buildResultPlainText } from '../utils/result-formatter';
import { getWebUserId } from '../utils/atlas-session';

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<AnalysisArchiveRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (!id) return;
    getArchiveRecord(getWebUserId(), id)
      .then(setRecord)
      .catch((err) => setError(err instanceof Error ? err.message : 'Kayıt yüklenemedi.'));
  }, [id]);

  const copyResult = async () => {
    if (!record?.envelope) return;
    const text = buildResultPlainText(record.title, record.envelope);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied('idle'), 2400);
  };

  if (error) {
    return (
      <CosmicShell>
        <main className="mx-auto max-w-2xl px-4 py-28 md:px-8">
          <div
            className="rounded-2xl border border-red-400/20 bg-red-950/20 p-6 text-center"
            role="alert"
          >
            <p className="text-sm leading-6 text-red-100/90">{error}</p>
            <Link
              to="/archive"
              className="site-focus mt-4 inline-block text-sm text-red-100/80 underline-offset-4 transition hover:underline"
            >
              Arşive dön
            </Link>
          </div>
        </main>
      </CosmicShell>
    );
  }

  if (!record) {
    return (
      <CosmicShell>
        <main
          className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Sonuç yükleniyor.</span>
          <div className="space-y-4 motion-safe:animate-pulse" aria-hidden="true">
            <div className="h-3 w-28 rounded-full bg-white/[0.06]" />
            <div className="h-9 w-2/3 rounded-lg bg-white/[0.05]" />
            <div className="h-40 rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
            <div className="h-40 rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
          </div>
        </main>
      </CosmicShell>
    );
  }

  return (
    <CosmicShell showBackground={false}>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8 print:max-w-none print:px-8 print:pt-8">
        {record.envelope ? (
          <ResultRenderer title={record.title} envelope={record.envelope} />
        ) : (
          <p className="text-[#e8ecf2]/55">Sonuç verisi bulunamadı.</p>
        )}

        <div className="mt-10 flex flex-wrap gap-2.5 print:hidden">
          <Link to="/analysis" className="atlas-btn-primary gap-2 !min-h-11 !px-5">
            <Plus size={16} aria-hidden /> Yeni Analiz
          </Link>
          <button
            type="button"
            onClick={() =>
              navigate('/atlas', {
                state: {
                  contextPrompt: `Bu analiz sonucu hakkında konuşmak istiyorum: ${record.title}`,
                },
              })
            }
            className="atlas-btn-secondary gap-2 !min-h-11 !px-5"
          >
            <MessageCircle size={16} aria-hidden /> Atlas’a Sor
          </button>
          <button type="button" onClick={copyResult} className="atlas-btn-ghost">
            <Copy size={16} aria-hidden />
            <span aria-live="polite">
              {copied === 'done'
                ? 'Kopyalandı'
                : copied === 'failed'
                  ? 'Kopyalanamadı'
                  : 'Kopyala'}
            </span>
          </button>
          <button type="button" onClick={() => window.print()} className="atlas-btn-ghost">
            <Printer size={16} aria-hidden /> Yazdır
          </button>
          <Link to="/archive" className="atlas-btn-ghost">
            Arşivi Görüntüle
          </Link>
        </div>
      </main>
    </CosmicShell>
  );
}
