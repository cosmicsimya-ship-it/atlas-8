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

const rowClass =
  'site-focus inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-[#d4dae2] transition duration-200 hover:border-white/20 hover:bg-white/[0.04]';

export default function ArchivePage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AnalysisArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
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
    setPendingDelete(null);
    await deleteArchiveRecord(getWebUserId(), id);
    load();
  };

  return (
    <CosmicShell>
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-28 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
          Arşiv
        </p>
        <h1 className="mt-4 font-display text-[clamp(1.85rem,4vw,2.6rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]">
          Önceki analizler
        </h1>

        {records.length > 0 && (
          <div className="relative mt-8">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e8ecf2]/35" />
            <input
              className="atlas-field py-3 pl-11 pr-4 text-sm"
              placeholder="Başlık, niyet veya durum ara…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Arşivde ara"
            />
          </div>
        )}

        {loading && (
          <div className="mt-10 space-y-4" aria-live="polite" aria-busy="true">
            <span className="sr-only">Arşiv yükleniyor.</span>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl border border-white/[0.06] bg-white/[0.02] motion-safe:animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-10 rounded-2xl border border-red-400/20 bg-red-950/20 p-6" role="alert">
            <p className="text-sm leading-6 text-red-100/90">{error}</p>
            <button
              type="button"
              onClick={load}
              className="site-focus mt-3 text-sm text-red-100/80 underline-offset-4 transition hover:underline"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="text-[#e8ecf2]/72">Arşivin henüz boş.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8b93a3]">
              Tamamladığın her analiz burada birikir ve istediğin zaman yeniden açılır.
            </p>
            <Link to="/analysis" className="atlas-btn-primary mt-6">
              İlk analizini başlat
            </Link>
          </div>
        )}

        {!loading && !error && records.length > 0 && filtered.length === 0 && (
          <p className="mt-12 text-center text-sm text-[#8b93a3]">
            “{query.trim()}” için eşleşen bir kayıt yok.
          </p>
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
                    <h2 className="font-display text-xl text-[#e8ecf2]/92">{record.title}</h2>
                    <p className="mt-1 text-xs text-[#e8ecf2]/40">
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
                    <Link to={`/analysis/result/${record.id}`} className={rowClass}>
                      Aç
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/atlas', {
                          state: { contextPrompt: `Arşivdeki analiz: ${record.title}` },
                        })
                      }
                      className={rowClass}
                    >
                      <MessageCircle size={14} aria-hidden /> Devam
                    </button>
                    {pendingDelete === record.id ? (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => remove(record.id)}
                          className="site-focus inline-flex min-h-10 items-center rounded-full border border-red-400/35 bg-red-500/10 px-4 text-sm text-red-200 transition duration-200 hover:bg-red-500/15"
                        >
                          Sil
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(null)}
                          className="site-focus inline-flex min-h-10 items-center rounded-full px-3 text-sm text-[#8b93a3] transition duration-200 hover:text-[#d4dae2]"
                        >
                          Vazgeç
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(record.id)}
                        className="site-focus inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-[#9aa3b0] transition duration-200 hover:border-red-400/30 hover:text-red-200"
                      >
                        <Trash2 size={14} aria-hidden /> Sil
                      </button>
                    )}
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
