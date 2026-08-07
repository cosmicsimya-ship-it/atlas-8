import { Copy, MessageCircle, Plus, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import ResultRenderer from '../components/cosmic/ResultRenderer';
import { getArchiveRecord } from '../services/analysis-archive';
import type { AnalysisArchiveRecord } from '../services/analysis-archive';
import {
  archiveLoadUserMessage,
  emptyResultUserCopy,
} from '../utils/archive-result-contract';
import { buildResultPlainText } from '../utils/result-formatter';
import { getWebUserId } from '../utils/atlas-session';

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<AnalysisArchiveRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  const reload = () => {
    if (!id) return;
    setError(null);
    setRecord(null);
    getArchiveRecord(getWebUserId(), id)
      .then(setRecord)
      .catch((err) => setError(archiveLoadUserMessage(err)));
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setError(null);
    setRecord(null);
    getArchiveRecord(getWebUserId(), id)
      .then((next) => {
        if (!cancelled) setRecord(next);
      })
      .catch((err) => {
        if (!cancelled) setError(archiveLoadUserMessage(err));
      });
    return () => {
      cancelled = true;
    };
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
            className="rounded-2xl border border-amber-400/20 bg-amber-950/20 p-6 text-center"
            role="alert"
          >
            <p className="text-sm leading-6 text-amber-50/90">{error}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={reload}
                className="site-focus text-sm text-amber-100/85 underline-offset-4 transition hover:underline"
              >
                Tekrar dene
              </button>
              <Link
                to="/archive"
                className="site-focus text-sm text-amber-100/80 underline-offset-4 transition hover:underline"
              >
                Arşive dön
              </Link>
            </div>
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

  const missing = !record.envelope ? emptyResultUserCopy('missing_envelope') : null;

  return (
    <CosmicShell showBackground={false}>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8 print:max-w-none print:px-8 print:pt-8">
        {record.envelope ? (
          <ResultRenderer title={record.title} envelope={record.envelope} />
        ) : (
          <article className="space-y-4 border-b border-white/10 pb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-[#c9b37a]/70">Analiz Sonucu</p>
            <h1 className="font-display text-3xl leading-tight text-[#e8ecf2] md:text-4xl">
              {record.title}
            </h1>
            {missing && (
              <div
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                role="status"
              >
                <p className="font-display text-lg text-[#e8ecf2]/92">{missing.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#e8ecf2]/68">{missing.body}</p>
                <p className="mt-3 text-xs text-[#c9b37a]/75">{missing.actionHint}</p>
              </div>
            )}
          </article>
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
          <button
            type="button"
            onClick={copyResult}
            disabled={!record.envelope}
            className="atlas-btn-ghost disabled:opacity-40"
          >
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
