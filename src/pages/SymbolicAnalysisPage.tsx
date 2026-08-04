import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import { submitSymbolicAnalysis } from '../services/symbolic-analysis';
import type {
  SymbolicAnalysisInput,
  SymbolicUserResult,
} from '../types/symbolic-analysis';
import { ensureAtlasSession } from '../utils/atlas-session';
import { parseDisplayDateToIso } from '../utils/analysis-form';
import { prefersReducedMotion } from '../utils/scroll-section';
import { cn } from '../utils/cn';

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[#e8ecf2] outline-none transition placeholder:text-[#e8ecf2]/28 focus:border-[#c9b37a]/45 focus:ring-1 focus:ring-[#c9b37a]/25';

const labelClass = 'mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-[#9aa3ae]';

type FormState = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  intention: string;
  fullName: string;
  motherName: string;
  consentSymbolic: boolean;
  consentData: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  birthDate: '',
  birthTime: '',
  birthPlace: '',
  intention: '',
  fullName: '',
  motherName: '',
  consentSymbolic: false,
  consentData: false,
});

function statusLabel(status: SymbolicUserResult['status']): string {
  switch (status) {
    case 'roadmap':
      return 'Hazırlanıyor';
    case 'partial':
      return 'Kısmi';
    case 'complete':
      return 'Tamamlandı';
    case 'insufficient_data':
      return 'Eksik veri';
    default:
      return status;
  }
}

export default function SymbolicAnalysisPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showOptional, setShowOptional] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SymbolicUserResult | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  // The reading renders below the form — take the reader to it.
  useEffect(() => {
    if (!result) return;
    resultRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [result]);

  const update = (partial: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setShowMethod(false);

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Ad zorunludur.');
      return;
    }
    const birthIso = parseDisplayDateToIso(form.birthDate);
    if (!birthIso) {
      setError('Geçerli bir doğum tarihi gir (GG.AA.YYYY veya YYYY-MM-DD).');
      return;
    }
    if (!form.consentSymbolic || !form.consentData) {
      setError('Devam etmek için her iki onayı da işaretlemen gerekir.');
      return;
    }

    const input: SymbolicAnalysisInput = {
      name: form.name.trim(),
      birthDate: birthIso,
      birthTime: form.birthTime.trim() || null,
      birthPlace: form.birthPlace.trim() || null,
      intention: form.intention.trim() || null,
      fullName: form.fullName.trim() || null,
      motherName: form.motherName.trim() || null,
      photoRef: null,
      consents: {
        symbolicReading: form.consentSymbolic,
        dataProcessing: form.consentData,
      },
    };

    setLoading(true);
    try {
      await ensureAtlasSession();
      const response = await submitSymbolicAnalysis({ input });
      setResult(response.userResult);
      if (!response.ok) {
        if (response.error === 'CONSENT_REQUIRED') {
          setError('Onay olmadan analiz işlenmez.');
        } else if (response.userResult?.status === 'insufficient_data') {
          setError(
            response.missingRequired?.length
              ? `Eksik: ${response.missingRequired.join(', ')}`
              : 'Gerekli alanlar eksik.',
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analiz isteği başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CosmicShell transparentNav showBackground>
      <main className="relative mx-auto w-full max-w-3xl px-4 pb-24 pt-24 sm:px-6 md:px-8 md:pt-28">
        <div
          className="pointer-events-none absolute inset-x-0 top-16 -z-10 mx-auto h-72 max-w-2xl bg-[radial-gradient(ellipse_at_center,rgba(201,179,122,0.09),transparent_70%)]"
          aria-hidden="true"
        />

        <header className="space-y-4 border-b border-white/[0.08] pb-8 sm:pb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
            Sembolik Analiz
          </p>
          <h1 className="font-display text-[clamp(1.85rem,4.4vw,2.85rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]">
            Tek bir okuma.
          </h1>
          <p className="max-w-xl text-[14px] leading-7 text-[#8b93a3] sm:text-[15px]">
            Gerekli bilgileri paylaş. Anlam katmanları arka planda birleşir; ekranda yalnızca
            bütünlüklü sonuç akışı görünür.
          </p>
        </header>

        <form onSubmit={onSubmit} className="mt-8 space-y-6 sm:mt-10" noValidate>
          <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm sm:rounded-[1.5rem] sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9aa3ae]">
              Gerekli bilgiler
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="sym-name" className={labelClass}>
                  Ad
                </label>
                <input
                  id="sym-name"
                  className={fieldClass}
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  autoComplete="given-name"
                  placeholder="Analizde kullanılacak isim"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="sym-birth" className={labelClass}>
                  Doğum tarihi
                </label>
                <input
                  id="sym-birth"
                  className={fieldClass}
                  value={form.birthDate}
                  onChange={(e) => update({ birthDate: e.target.value })}
                  placeholder="GG.AA.YYYY"
                  inputMode="numeric"
                  required
                />
              </div>
            </div>

            <div className="mt-5 border-t border-white/[0.06] pt-5">
              <label htmlFor="sym-intention" className={labelClass}>
                İsteğe bağlı niyet veya soru
              </label>
              <textarea
                id="sym-intention"
                className={cn(fieldClass, 'min-h-[88px] resize-y')}
                value={form.intention}
                onChange={(e) => update({ intention: e.target.value })}
                placeholder="Ne üzerine bakmak istiyorsun?"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="mt-5 text-[12px] tracking-[0.04em] text-[#c9b37a]/80 transition hover:text-[#e8d9a8]"
            >
              {showOptional ? 'Diğer isteğe bağlı alanları gizle' : 'Diğer isteğe bağlı alanlar'}
            </button>

            {showOptional ? (
              <div className="mt-5 grid gap-5 border-t border-white/[0.06] pt-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="sym-time" className={labelClass}>
                    Doğum saati
                  </label>
                  <input
                    id="sym-time"
                    className={fieldClass}
                    value={form.birthTime}
                    onChange={(e) => update({ birthTime: e.target.value })}
                    placeholder="SS:DD (opsiyonel)"
                  />
                </div>
                <div>
                  <label htmlFor="sym-place" className={labelClass}>
                    Doğum yeri
                  </label>
                  <input
                    id="sym-place"
                    className={fieldClass}
                    value={form.birthPlace}
                    onChange={(e) => update({ birthPlace: e.target.value })}
                    placeholder="Opsiyonel"
                  />
                </div>
                <div>
                  <label htmlFor="sym-fullname" className={labelClass}>
                    Tam isim
                  </label>
                  <input
                    id="sym-fullname"
                    className={fieldClass}
                    value={form.fullName}
                    onChange={(e) => update({ fullName: e.target.value })}
                    placeholder="Opsiyonel"
                  />
                </div>
                <div>
                  <label htmlFor="sym-mother" className={labelClass}>
                    Anne adı
                  </label>
                  <input
                    id="sym-mother"
                    className={fieldClass}
                    value={form.motherName}
                    onChange={(e) => update({ motherName: e.target.value })}
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <fieldset className="rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4 sm:p-6">
            <legend className="px-1 text-[10px] uppercase tracking-[0.2em] text-[#9aa3ae]">
              Açık onaylar
            </legend>
            <div className="mt-3 space-y-4">
              <label className="flex cursor-pointer gap-3 text-[13px] leading-6 text-[#a8b0bd]">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[#c9b37a]"
                  checked={form.consentSymbolic}
                  onChange={(e) => update({ consentSymbolic: e.target.checked })}
                />
                <span>
                  Bu okumanın sembolik bir düşünme alanı olduğunu; kesin kader, ilahi hüküm veya
                  tıbbi/psikolojik tedavi önerisi olmadığını anlıyorum.
                </span>
              </label>
              <label className="flex cursor-pointer gap-3 text-[13px] leading-6 text-[#a8b0bd]">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[#c9b37a]"
                  checked={form.consentData}
                  onChange={(e) => update({ consentData: e.target.checked })}
                />
                <span>
                  Paylaştığım bilgilerin bu analiz için işlenmesine açıkça onay veriyorum.
                  Fotoğraf yüklenmez; görüntü saklanmaz.
                </span>
              </label>
            </div>
          </fieldset>

          {error ? (
            <p className="text-sm text-red-300/90" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={loading} className="atlas-btn-primary min-h-12 gap-2">
              {loading ? (
                <>
                  <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden />
                  Hazırlanıyor…
                </>
              ) : (
                'Analizi başlat'
              )}
            </button>
            <Link to="/" className="atlas-btn-secondary">
              Ana sayfa
            </Link>
          </div>
        </form>

        {result ? (
          <section
            id="symbolic-result"
            ref={resultRef}
            className="mt-12 scroll-mt-24 space-y-8 border-t border-white/[0.08] pt-10 sm:mt-14 sm:pt-12"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9b37a]/70">
                  Birleşik sonuç
                </p>
                <h2 className="mt-2 font-brand text-xl font-semibold tracking-[-0.02em] text-[#e8ecf2] sm:text-2xl">
                  {result.title}
                </h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] tracking-[0.12em] text-[#8b93a3]">
                {statusLabel(result.status)}
              </span>
            </div>

            {result.methodologyPresentation ? (
              <div
                className="rounded-[1.25rem] border border-[#c9b37a]/20 bg-[#c9b37a]/[0.06] px-4 py-4 sm:px-5"
                data-testid="methodology-presentation"
              >
                <p className="font-display text-[15px] text-[#e8d9a8]">
                  {result.methodologyPresentation.displayName}
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#a8b0bd]">
                  {result.methodologyPresentation.disclaimer}
                </p>
                {result.methodologyPresentation.comingSoon?.map((item) => (
                  <p
                    key={item.label}
                    className="mt-3 text-[12px] tracking-[0.04em] text-[#8b93a3]/90"
                  >
                    {item.label}
                    {!item.active ? ' (pasif)' : null}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="space-y-7">
              {result.sections.map((section) => (
                <article key={section.id} className="space-y-2">
                  <h3 className="font-display text-lg text-[#e8ecf2]/92 sm:text-xl">
                    {section.title}
                  </h3>
                  <p className="whitespace-pre-wrap text-[13px] leading-7 text-[#a8b0bd] sm:text-[14px]">
                    {section.body}
                  </p>
                </article>
              ))}
            </div>

            {result.methodDisclosure && result.methodDisclosure.length > 0 ? (
              <div className="rounded-[1.25rem] border border-white/[0.07] bg-black/25 px-4 py-4 sm:px-5 sm:py-5">
                <button
                  type="button"
                  onClick={() => setShowMethod((v) => !v)}
                  className="text-[13px] tracking-[0.04em] text-[#c9b37a]/85 transition hover:text-[#e8d9a8]"
                >
                  {showMethod ? 'Yöntemi gizle' : 'Yöntemi gör'}
                </button>
                {showMethod ? (
                  <div className="mt-4 space-y-4">
                    {result.methodDisclosure.map((item, idx) => (
                      <div
                        key={`${item.source}-${idx}`}
                        className="space-y-1 text-[12px] leading-6 text-[#8b93a3]"
                      >
                        {item.displayName ? (
                          <p className="text-[#c9b37a]/90">{item.displayName}</p>
                        ) : null}
                        {item.disclaimer ? <p>{item.disclaimer}</p> : null}
                        {item.selectionPathLabel ? (
                          <p>Seçim yolu: {item.selectionPathLabel}</p>
                        ) : null}
                        {item.experimental ? (
                          <p>Bu seçim yolu deneyseldir.</p>
                        ) : null}
                        <p>Kaynak: {item.displayName ? item.methodologyId || item.source : item.source}</p>
                        <p>Yöntem: {item.method}</p>
                        <p>
                          Kullanılan veri:{' '}
                          {(item.usedDataLabels || item.usedDataKeys).length
                            ? (item.usedDataLabels || item.usedDataKeys).join(', ')
                            : '—'}
                        </p>
                        <p>
                          Sınırlamalar:{' '}
                          {item.limitations.length ? item.limitations.join(' ') : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-[1.25rem] border border-white/[0.07] bg-black/25 px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-[13px] leading-6 text-[#8b93a3]">
                {result.methodologyPresentation
                  ? 'Sonuçlar Atlas Latin Harf-Sayı Motifi bağlamında sunulur. Ham teknik skor alanları yalnızca yöntem notlarında anlaşılır etiketlerle yer alır.'
                  : 'Bu deneyim tek bir üst çatı altında ilerler. Teknik motor isimleri ve iç skorlar kullanıcı arayüzünde gösterilmez.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Link to="/atlas" className="atlas-btn-secondary !min-h-11 !px-5">
                  Atlas ile devam et
                </Link>
                <Link to="/analysis" className="atlas-btn-ghost">
                  Kişisel analize geç
                </Link>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </CosmicShell>
  );
}
