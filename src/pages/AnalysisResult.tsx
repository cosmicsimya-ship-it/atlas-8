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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    getArchiveRecord(getWebUserId(), id)
      .then(setRecord)
      .catch((err) => setError(err instanceof Error ? err.message : 'Kayıt yüklenemedi.'));
  }, [id]);

  const copyResult = async () => {
    if (!record?.envelope) return;
    const text = buildResultPlainText(record.title, record.envelope);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <CosmicShell>
        <main className="mx-auto max-w-2xl px-4 py-28 text-center md:px-8">
          <p className="text-red-300">{error}</p>
          <Link to="/archive" className="mt-6 inline-block text-[#c9b37a]">
            Arşive dön
          </Link>
        </main>
      </CosmicShell>
    );
  }

  if (!record) {
    return (
      <CosmicShell>
        <main className="mx-auto max-w-2xl px-4 py-28 text-center text-[#f5f0e8]/50 md:px-8">
          Sonuç yükleniyor…
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
          <p className="text-[#f5f0e8]/55">Sonuç verisi bulunamadı.</p>
        )}

        <div className="mt-10 flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"
          >
            <Printer size={16} /> Yazdır
          </button>
          <button
            type="button"
            onClick={copyResult}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"
          >
            <Copy size={16} /> {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
          <button
            type="button"
            onClick={() =>
              navigate('/atlas', {
                state: {
                  contextPrompt: `Bu analiz sonucu hakkında konuşmak istiyorum: ${record.title}`,
                },
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"
          >
            <MessageCircle size={16} /> Atlas’a Sor
          </button>
          <Link
            to="/analysis"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f5f0e8] px-4 py-2 text-sm font-medium text-[#050505]"
          >
            <Plus size={16} /> Yeni Analiz
          </Link>
          <Link
            to="/archive"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#c9b37a]/30 px-4 py-2 text-sm text-[#c9b37a]"
          >
            Arşive Kaydedildi — Görüntüle
          </Link>
        </div>
      </main>
    </CosmicShell>
  );
}
