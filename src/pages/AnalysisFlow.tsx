import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AnalysisLoader from '../components/cosmic/AnalysisLoader';
import CosmicShell from '../components/cosmic/CosmicShell';
import { saveArchiveRecord } from '../services/analysis-archive';
import { submitPersonalAnalysis } from '../services/personal-analysis';
import { fetchUserMemory, patchUserMemory } from '../services/user-memory';
import type { PersonalAnalysisEnvelope } from '../types/personal-analysis';
import {
  ANALYSIS_STEPS,
  buildAnalysisTitle,
  buildUserNotes,
  createDefaultForm,
  INTENTION_OPTIONS,
  parseDisplayDateToIso,
  type AnalysisFormData,
  validateStep,
} from '../utils/analysis-form';
import { clearFormDraft, loadFormDraft, saveFormDraft } from '../utils/intro-prefs';
import { ensureAtlasSession, getWebUserId } from '../utils/atlas-session';

function createAnalysisId() {
  return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[#e8ecf2] outline-none transition placeholder:text-[#e8ecf2]/28 focus:border-[#c9b37a]/45 focus:ring-1 focus:ring-[#c9b37a]/25';

export default function AnalysisFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AnalysisFormData>(() => loadFormDraft() ?? createDefaultForm());
  const [error, setError] = useState<string | null>(null);
  const [memoryHints, setMemoryHints] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveFormDraft(form);
  }, [form]);

  useEffect(() => {
    ensureAtlasSession()
      .then((session) => fetchUserMemory(session.userId || getWebUserId()))
      .then((memory) => {
        setForm((prev) => {
          const next = { ...prev };
          const hints: Record<string, boolean> = {};
          if (memory.profile.name && !prev.name) {
            next.name = memory.profile.name;
            hints.name = true;
          }
          if (memory.profile.birthDate && !prev.birthDate) {
            next.birthDate = memory.profile.birthDate;
            hints.birthDate = true;
          }
          if (memory.profile.birthTime && !prev.birthTime) {
            next.birthTime = memory.profile.birthTime;
            hints.birthTime = true;
          }
          if (memory.profile.birthPlace && !prev.birthPlace) {
            next.birthPlace = memory.profile.birthPlace;
            hints.birthPlace = true;
          }
          if (memory.profile.location && !prev.location) {
            next.location = memory.profile.location;
            hints.location = true;
          }
          if (memory.profile.referenceDate && !prev.referenceDate) {
            next.referenceDate = memory.profile.referenceDate;
            hints.referenceDate = true;
          }
          setMemoryHints(hints);
          return next;
        });
      })
      .catch(() => {
        /* memory optional */
      });

    return () => abortRef.current?.abort();
  }, []);

  const update = useCallback((partial: Partial<AnalysisFormData>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setError(null);
  }, []);

  const goNext = () => {
    const validation = validateStep(step, form);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    const validation = validateStep(step, form);
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    setSubmitError(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userId = getWebUserId();
    const analysisId = createAnalysisId();
    const birthIso = parseDisplayDateToIso(form.birthDate)!;
    const refIso = parseDisplayDateToIso(form.referenceDate)!;

    try {
      await patchUserMemory(userId, {
        profile: {
          name: form.name.trim(),
          birthDate: form.birthDate.trim(),
          birthTime: form.birthTimeUnknown ? null : form.birthTime.trim() || null,
          birthPlace: form.birthPlace.trim(),
          location: form.location.trim(),
          referenceDate: refIso,
        },
      });

      const envelope: PersonalAnalysisEnvelope = await submitPersonalAnalysis(
        {
          task_id: analysisId,
          subject_id: userId,
          subject_profile: {
            birth_data: {
              date: birthIso,
              time: form.birthTimeUnknown ? null : form.birthTime.trim() || null,
              place: form.birthPlace.trim(),
            },
            life_events: [],
            user_notes: buildUserNotes(form),
          },
        },
        abortRef.current.signal,
      );

      const record = await saveArchiveRecord(userId, {
        id: analysisId,
        title: buildAnalysisTitle(form),
        intention: form.intention,
        status: envelope.status,
        name: form.name.trim(),
        referenceDate: refIso,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formSummary: {
          name: form.name,
          birthDate: form.birthDate,
          birthTime: form.birthTimeUnknown ? null : form.birthTime,
          birthPlace: form.birthPlace,
          location: form.location,
          referenceDate: form.referenceDate,
          intention: form.intention,
          customQuestion: form.customQuestion,
        },
        envelope,
      });

      clearFormDraft();
      navigate(`/analysis/result/${record.id}`, { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Analiz gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const MemoryHint = ({ field }: { field: string }) =>
    memoryHints[field] ? (
      <p className="mt-2 text-xs text-[#c9b37a]/75">
        Atlas bu bilgiyi daha önceki oturumundan hatırlıyor.
      </p>
    ) : null;

  if (loading) {
    return (
      <CosmicShell>
        <main className="flex min-h-[100dvh] items-center px-4 py-28 md:px-8">
          <AnalysisLoader />
        </main>
      </CosmicShell>
    );
  }

  return (
    <CosmicShell>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-28 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
          Haritamı Oku
        </p>
        <h1 className="mt-4 font-display text-[clamp(1.85rem,4vw,2.6rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]">
          Koordinatlar toplanıyor
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#e8ecf2]/48">
          Atlas analiz için gerekli verileri adım adım toplar. Her adım bir form alanı değil, bir
          katman.
        </p>

        <div className="mt-8 flex gap-2 overflow-x-auto pb-2" aria-label="Adımlar">
          {ANALYSIS_STEPS.map((label, i) => (
            <span
              key={label}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                i === step
                  ? 'bg-[#c9b37a]/15 text-[#c9b37a]'
                  : i < step
                    ? 'bg-white/8 text-[#e8ecf2]/55'
                    : 'bg-white/[0.03] text-[#e8ecf2]/28'
              }`}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          {step === 0 && (
            <label className="block">
              <span className="mb-2 block text-sm text-[#e8ecf2]/70">Adın veya tercih ettiğin hitap</span>
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                autoComplete="name"
              />
              <MemoryHint field="name" />
            </label>
          )}

          {step === 1 && (
            <label className="block">
              <span className="mb-2 block text-sm text-[#e8ecf2]/70">Doğum tarihi</span>
              <input
                className={fieldClass}
                placeholder="GG.AA.YYYY"
                value={form.birthDate}
                onChange={(e) => update({ birthDate: e.target.value })}
              />
              <MemoryHint field="birthDate" />
            </label>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-[#e8ecf2]/70">Doğum saati</span>
                <input
                  className={fieldClass}
                  placeholder="SS:DD"
                  value={form.birthTime}
                  disabled={form.birthTimeUnknown}
                  onChange={(e) => update({ birthTime: e.target.value })}
                />
                <MemoryHint field="birthTime" />
              </label>
              <label className="flex items-center gap-3 text-sm text-[#e8ecf2]/70">
                <input
                  type="checkbox"
                  checked={form.birthTimeUnknown}
                  onChange={(e) =>
                    update({ birthTimeUnknown: e.target.checked, birthTime: e.target.checked ? '' : form.birthTime })
                  }
                  className="h-4 w-4 rounded border-white/20"
                />
                Bilmiyorum
              </label>
            </div>
          )}

          {step === 3 && (
            <label className="block">
              <span className="mb-2 block text-sm text-[#e8ecf2]/70">Doğum yeri</span>
              <input
                className={fieldClass}
                value={form.birthPlace}
                onChange={(e) => update({ birthPlace: e.target.value })}
              />
              <MemoryHint field="birthPlace" />
            </label>
          )}

          {step === 4 && (
            <label className="block">
              <span className="mb-2 block text-sm text-[#e8ecf2]/70">Güncel konum</span>
              <input
                className={fieldClass}
                value={form.location}
                onChange={(e) => update({ location: e.target.value })}
              />
              <MemoryHint field="location" />
            </label>
          )}

          {step === 5 && (
            <label className="block">
              <span className="mb-2 block text-sm text-[#e8ecf2]/70">Referans tarihi</span>
              <input
                className={fieldClass}
                type="date"
                value={parseDisplayDateToIso(form.referenceDate) ?? form.referenceDate}
                onChange={(e) => update({ referenceDate: e.target.value })}
              />
              <MemoryHint field="referenceDate" />
            </label>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-3 text-sm text-[#e8ecf2]/70">Analiz niyeti</legend>
                <div className="grid gap-2">
                  {INTENTION_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                        form.intention === opt.id
                          ? 'border-[#c9b37a]/40 bg-[#c9b37a]/8'
                          : 'border-white/10 bg-white/[0.02]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="intention"
                        checked={form.intention === opt.id}
                        onChange={() => update({ intention: opt.id })}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {form.intention === 'custom' && (
                <label className="block">
                  <span className="mb-2 block text-sm text-[#e8ecf2]/70">Özel sorun</span>
                  <textarea
                    className={`${fieldClass} min-h-28 resize-y`}
                    value={form.customQuestion}
                    onChange={(e) => update({ customQuestion: e.target.value })}
                  />
                </label>
              )}
            </div>
          )}

          {step === 7 && (
            <dl className="space-y-3 text-sm">
              {[
                ['Ad', form.name],
                ['Doğum tarihi', form.birthDate],
                ['Doğum saati', form.birthTimeUnknown ? 'Bilinmiyor' : form.birthTime || '—'],
                ['Doğum yeri', form.birthPlace],
                ['Konum', form.location],
                ['Referans tarihi', form.referenceDate],
                ['Niyet', INTENTION_OPTIONS.find((o) => o.id === form.intention)?.label],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4 border-b border-white/6 pb-2">
                  <dt className="text-[#e8ecf2]/45">{label}</dt>
                  <dd className="text-right text-[#e8ecf2]/82">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          {submitError && (
            <p className="mt-4 text-sm text-red-300" role="alert">
              {submitError}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="atlas-btn-secondary gap-1.5 !min-h-11 !px-4 disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronLeft size={16} aria-hidden /> Geri
          </button>

          {step < ANALYSIS_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="atlas-btn-primary gap-1.5 !min-h-11 !px-5"
            >
              İleri <ChevronRight size={16} aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={submit} className="atlas-btn-primary !min-h-11 !px-5">
              Analizi Başlat
            </button>
          )}
        </div>
      </main>
    </CosmicShell>
  );
}
