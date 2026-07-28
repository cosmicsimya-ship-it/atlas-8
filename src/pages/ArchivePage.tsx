import { MessageCircle, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import {
  deleteArchiveRecord,
  listArchive,
  type AnalysisArchiveRecord,
} from '../services/analysis-archive';
import { statusPresentation } from '../utils/result-formatter';
import { getWebUserId } from '../utils/atlas-session';

export default function ArchivePage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AnalysisArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = () => {
    setLoading(true);
    listArchive(getWebUserId())
      .then(setRecords)
      .catch((err) => setError(err instanceof Error ? err.message : 'Arşiv yüklenemedi.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.intention.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [records, query]);

  const remove = async (id: string) => {
    if (!window.confirm('Bu analizi arşivden silmek istiyor musun?')) return;
    await deleteArchiveRecord(getWebUserId(), id);
    load();
  };

  return (
    <CosmicShell>
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-28 md:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-[#c9b37a]/65">Arşiv</p>
        <h1 className="mt-2 font-display text-3xl text-[#f5f0e8]">Önceki analizler</h1>

        <div className="relative mt-8">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f5f0e8]/35" />
          <input
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm outline-none focus:border-[#c9b37a]/40"
            placeholder="Başlık, niyet veya durum ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading && <p className="mt-10 text-[#f5f0e8]/45">Yükleniyor…</p>}
        {error && (
          <p className="mt-10 text-red-300" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="text-[#f5f0e8]/55">Henüz kayıtlı analiz yok.</p>
            <Link
              to="/analysis"
              className="mt-4 inline-block text-sm text-[#c9b37a] underline-offset-4 hover:underline"
            >
              İlk analizini başlat
            </Link>
          </div>
        )}

        <ul className="mt-8 space-y-4">
          {filtered.map((record) => {
            const status = statusPresentation(record.status);
            return (
              <li
                key={record.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="font-display text-xl text-[#f5f0e8]/92">{record.title}</h2>
                    <p className="mt-1 text-xs text-[#f5f0e8]/40">
                      {new Date(record.updatedAt).toLocaleString('tr-TR')} · {record.intention}
                    </p>
                    <span
                      className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${
                        status.tone === 'success'
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : status.tone === 'danger'
                            ? 'bg-red-500/10 text-red-300'
                            : 'bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/analysis/result/${record.id}`}
                      className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-4 text-sm"
                    >
                      Aç
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/atlas', {
                          state: { contextPrompt: `Arşivdeki analiz: ${record.title}` },
                        })
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm"
                    >
                      <MessageCircle size={14} /> Devam
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(record.id)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-500/20 px-4 text-sm text-red-300"
                    >
                      <Trash2 size={14} /> Sil
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </CosmicShell>
  );
}
