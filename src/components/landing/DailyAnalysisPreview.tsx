import { Loader2, RotateCcw } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { landingDailyPreview } from '../../data/landing-content';
import { submitSymbolicAnalysis } from '../../services/symbolic-analysis';
import { ApiError } from '../../services/api-client';
import type {
  SymbolicAnalysisInput,
  SymbolicAnalysisResponse,
  SymbolicUserResult,
} from '../../types/symbolic-analysis';
import { ensureAtlasSession } from '../../utils/atlas-session';
import { parseDisplayDateToIso } from '../../utils/analysis-form';
import { prefersReducedMotion } from '../../utils/scroll-section';
import { cn } from '../../utils/cn';

const fieldClass = 'obs-field-input';

const labelClass =
  'mb-1.5 block text-[0.7rem] font-medium tracking-[0.04em] text-[#9a9488]';

type FormState = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthTimeUnknown: boolean;
  birthPlace: string;
  intention: string;
  consentSymbolic: boolean;
  consentData: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  birthDate: '',
  birthTime: '',
  birthTimeUnknown: false,
  birthPlace: '',
  intention: '',
  consentSymbolic: false,
  consentData: false,
});

type UiPhase = 'idle' | 'loading' | 'success' | 'error';

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

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return 'Bağlantı kurulamadı. Ağ veya CORS ayarını kontrol edip tekrar dene.';
    }
    if (err.status === 408) {
      return 'Yanıt zaman aşımına uğradı. Biraz sonra tekrar dene.';
    }
    if (err.status === 401 || err.status === 403) {
      return 'Oturum doğrulanamadı. Sayfayı yenileyip tekrar dene.';
    }
    if (err.status >= 500) {
      return 'Analiz servisi şu an yanıt veremiyor. Lütfen tekrar dene.';
    }
    return err.message || 'İstek tamamlanamadı.';
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Beklenmeyen bir hata oluştu.';
}

function buildInput(form: FormState, birthIso: string): SymbolicAnalysisInput {
  return {
    name: form.name.trim(),
    birthDate: birthIso,
    birthTime: form.birthTimeUnknown ? null : form.birthTime.trim() || null,
    birthPlace: form.birthPlace.trim() || null,
    intention: form.intention.trim() || null,
    fullName: null,
    motherName: null,
    photoRef: null,
    consents: {
      symbolicReading: form.consentSymbolic,
      dataProcessing: form.consentData,
    },
  };
}

export default function DailyAnalysisPreview() {
  const { id, eyebrow, title, subtitle, cta } = landingDailyPreview;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [phase, setPhase] = useState<UiPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SymbolicAnalysisResponse | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const update = (partial: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    if (phase === 'error') {
      setError(null);
      setPhase('idle');
    }
  };

  const runAnalysis = async () => {
    if (phase === 'loading') return;

    setError(null);
    setResponse(null);

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Ad veya analiz başlığı en az 2 karakter olmalı.');
      setPhase('error');
      return;
    }
    const birthIso = parseDisplayDateToIso(form.birthDate);
    if (!birthIso) {
      setError('Geçerli bir doğum tarihi gir (GG.AA.YYYY veya YYYY-MM-DD).');
      setPhase('error');
      return;
    }
    if (
      !form.birthTimeUnknown &&
      form.birthTime.trim() &&
      !/^\d{1,2}[:.]\d{2}$/.test(form.birthTime.trim())
    ) {
      setError('Doğum saatini SS:DD biçiminde gir veya “Bilmiyorum” seç.');
      setPhase('error');
      return;
    }
    if (!form.consentSymbolic || !form.consentData) {
      setError('Devam etmek için her iki onayı da işaretlemen gerekir.');
      setPhase('error');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase('loading');
    try {
      await ensureAtlasSession();
      const payload = await submitSymbolicAnalysis(
        { input: buildInput(form, birthIso) },
        controller.signal,
      );

      if (!payload || typeof payload !== 'object' || !payload.userResult) {
        setError('Geçersiz veya boş yanıt alındı. Tekrar dene.');
        setPhase('error');
        return;
      }

      setResponse(payload);
      setPhase('success');

      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'nearest',
        });
      });
    } catch (err) {
      if (abortRef.current !== controller || controller.signal.aborted) {
        return;
      }
      setError(friendlyError(err));
      setPhase('error');
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runAnalysis();
  };

  const result = response?.userResult ?? null;
  const sections = result?.sections?.filter((s) => s.body?.trim()) ?? [];
  const timeUnknownNote =
    form.birthTimeUnknown || !form.birthTime.trim()
      ? 'Doğum saati belirtilmedi; saat bağımlı katmanlar bilinçli olarak belirsiz bırakıldı.'
      : null;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24" aria-labelledby="daily-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#c9b37a]/65">
            {eyebrow}
          </p>
          <h2
            id="daily-title"
            className="mt-4 font-display text-[clamp(1.85rem,4vw,2.6rem)] font-medium tracking-[-0.02em] text-[#f5f0e6]"
          >
            {title}
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#9a9488]">{subtitle}</p>
        </div>

        {/* Observation instrument / control surface — not a web form card */}
        <div className="obs-control-surface relative mt-10 overflow-hidden">
          <div
            className="pointer-events-none absolute left-0 top-0 h-px w-16 bg-[#c9b37a]/45"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-0 top-0 h-16 w-px bg-[#c9b37a]/45"
            aria-hidden="true"
          />
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="min-w-0 border-b border-white/[0.06] px-4 py-5 sm:px-6 sm:py-7 lg:border-b-0 lg:border-r lg:border-white/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <span className="atlas-mark atlas-mark-sm text-[0.7rem]">ATLAS</span>
                <span className="font-mono text-[0.65rem] tracking-[0.18em] text-[#8b93a3]">
                  LIVE · OBS
                </span>
              </div>

              <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
                <div>
                  <label htmlFor="sample-name" className={labelClass}>
                    Ad
                  </label>
                  <input
                    id="sample-name"
                    className={fieldClass}
                    value={form.name}
                    onChange={(e) => update({ name: e.target.value })}
                    autoComplete="given-name"
                    placeholder="Örn. Ayşe"
                    disabled={phase === 'loading'}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="sample-birth" className={labelClass}>
                    Doğum tarihi
                  </label>
                  <input
                    id="sample-birth"
                    className={fieldClass}
                    value={form.birthDate}
                    onChange={(e) => update({ birthDate: e.target.value })}
                    placeholder="GG.AA.YYYY"
                    inputMode="numeric"
                    disabled={phase === 'loading'}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sample-time" className={labelClass}>
                      Doğum saati
                    </label>
                    <input
                      id="sample-time"
                      className={fieldClass}
                      value={form.birthTime}
                      onChange={(e) =>
                        update({ birthTime: e.target.value, birthTimeUnknown: false })
                      }
                      placeholder="SS:DD"
                      disabled={phase === 'loading' || form.birthTimeUnknown}
                    />
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-[#8b93a3]">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[#c9b37a]"
                        checked={form.birthTimeUnknown}
                        disabled={phase === 'loading'}
                        onChange={(e) =>
                          update({
                            birthTimeUnknown: e.target.checked,
                            birthTime: e.target.checked ? '' : form.birthTime,
                          })
                        }
                      />
                      Bilmiyorum
                    </label>
                  </div>
                  <div>
                    <label htmlFor="sample-place" className={labelClass}>
                      Doğum şehri
                    </label>
                    <input
                      id="sample-place"
                      className={fieldClass}
                      value={form.birthPlace}
                      onChange={(e) => update({ birthPlace: e.target.value })}
                      placeholder="Opsiyonel"
                      disabled={phase === 'loading'}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="sample-intention" className={labelClass}>
                    Analiz isteği
                  </label>
                  <textarea
                    id="sample-intention"
                    className={cn(fieldClass, 'min-h-[72px] resize-y')}
                    value={form.intention}
                    onChange={(e) => update({ intention: e.target.value })}
                    placeholder="Bu okumada neye bakmak istiyorsun?"
                    disabled={phase === 'loading'}
                  />
                </div>

                <fieldset className="space-y-3 border border-white/[0.08] bg-black/25 px-3.5 py-3">
                  <legend className="px-1 font-mono text-[0.65rem] tracking-[0.16em] text-[#9aa3ae]">
                    ONAYLAR
                  </legend>
                  <label className="flex cursor-pointer gap-2.5 text-[12px] leading-5 text-[#a8b0bd]">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#c9b37a]"
                      checked={form.consentSymbolic}
                      disabled={phase === 'loading'}
                      onChange={(e) => update({ consentSymbolic: e.target.checked })}
                    />
                    <span>
                      Bu okumanın sembolik bir düşünme alanı olduğunu; kesin hüküm olmadığını
                      anlıyorum.
                    </span>
                  </label>
                  <label className="flex cursor-pointer gap-2.5 text-[12px] leading-5 text-[#a8b0bd]">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#c9b37a]"
                      checked={form.consentData}
                      disabled={phase === 'loading'}
                      onChange={(e) => update({ consentData: e.target.checked })}
                    />
                    <span>Paylaştığım bilgilerin bu analiz için işlenmesine onay veriyorum.</span>
                  </label>
                </fieldset>

                {error ? (
                  <p className="text-[13px] leading-5 text-red-300/90" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={phase === 'loading'}
                    className="atlas-btn-primary !min-h-11 gap-2 !px-5 text-[13px]"
                  >
                    {phase === 'loading' ? (
                      <>
                        <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden />
                        Analiz hazırlanıyor…
                      </>
                    ) : (
                      cta
                    )}
                  </button>
                  {phase === 'error' ? (
                    <button
                      type="button"
                      onClick={() => void runAnalysis()}
                      className="atlas-btn-ghost inline-flex items-center gap-1.5 !min-h-11"
                    >
                      <RotateCcw size={14} aria-hidden />
                      Tekrar dene
                    </button>
                  ) : null}
                </div>
              </form>
            </div>

            <div
              ref={resultRef}
              className="min-w-0 px-4 py-5 sm:px-6 sm:py-6"
              aria-live="polite"
            >
              {phase === 'idle' && !result ? (
                <div className="flex h-full min-h-[220px] flex-col justify-center">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#9a9488]">
                    Sonuç alanı
                  </p>
                  <p className="mt-3 max-w-sm text-[14px] leading-7 text-[#9a9488]">
                    Analizi başlattığında Atlas’ın gerçek yanıtı burada görünür. Önceden
                    hazırlanmış demo metin yok.
                  </p>
                </div>
              ) : null}

              {phase === 'loading' ? (
                <div className="flex h-full min-h-[220px] flex-col items-start justify-center gap-3">
                  <div className="flex items-center gap-3 text-[#a8b0bd]">
                    <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden />
                    <span className="text-[14px]">Katmanlar okunuyor…</span>
                  </div>
                  <p className="max-w-sm text-[13px] leading-6 text-[#6f7886]">
                    Bu işlem mevcut analiz hattından gerçek sonuç üretir.
                  </p>
                </div>
              ) : null}

              {phase === 'error' && !result ? (
                <div className="flex h-full min-h-[220px] flex-col justify-center">
                  <p className="font-mono text-[0.7rem] tracking-[0.16em] text-red-300/70">
                    ANALİZ TAMAMLANAMADI
                  </p>
                  <p className="mt-3 max-w-sm text-[14px] leading-7 text-[#a8b0bd]">
                    {error ?? 'Bir sorun oluştu.'}
                  </p>
                </div>
              ) : null}

              {result ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="obs-label text-[#c9b37a]/70">Gerçek sonuç</p>
                      <h3 className="mt-1.5 font-display text-lg tracking-[-0.02em] text-[#e8ecf2] sm:text-xl">
                        {result.title}
                      </h3>
                    </div>
                    <span className="border border-white/10 px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.12em] text-[#8b93a3]">
                      {statusLabel(result.status)}
                    </span>
                  </div>

                  {timeUnknownNote ? (
                    <p className="border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12px] leading-5 text-[#8b93a3]">
                      {timeUnknownNote}
                    </p>
                  ) : null}

                  {response && !response.ok && response.missingRequired?.length ? (
                    <p className="text-[13px] text-[#c9b37a]/85" role="status">
                      Eksik: {response.missingRequired.join(', ')}
                    </p>
                  ) : null}

                  {sections.length > 0 ? (
                    <div className="space-y-4">
                      {sections.map((section) => (
                        <article
                          key={section.id}
                          className="border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                        >
                          <h4 className="text-[12px] font-medium tracking-[0.02em] text-[#e8ecf2]/92">
                            {section.title}
                          </h4>
                          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[#a8b0bd]">
                            {section.body}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] leading-6 text-[#8b93a3]">
                      Yanıt geldi; bu turda gösterilecek bir sentez bölümü yok. Niyetini netleştirip
                      tekrar deneyebilir veya Atlas sohbetinde devam edebilirsin.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2.5 border-t border-white/[0.06] pt-4">
                    <Link to="/analysis/symbolic" className="atlas-btn-secondary !min-h-10 !px-4 text-[12px]">
                      Tam sembolik analiz
                    </Link>
                    <Link to="/atlas" className="atlas-btn-ghost !min-h-10">
                      Atlas ile devam et
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
