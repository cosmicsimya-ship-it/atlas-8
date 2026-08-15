import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Sparkles, Trash2, User } from 'lucide-react';

import CosmicShell from '../components/cosmic/CosmicShell';
import PrimeRouteGuard from '../components/prime/PrimeRouteGuard';
import {
  ENERGY_OPTIONS,
  FOCUS_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
  deletePrimeMemoryFact,
  fetchPrimeMemory,
  fetchPrimeProfile,
  fetchPrimeToday,
  submitPrimeCheckin,
  updatePrimeProfile,
  type PrimeCheckin,
  type PrimeMemoryFact,
  type PrimeProfile,
  type PrimeToday,
} from '../services/atlas-prime';
import type { AtlasSessionInfo } from '../utils/atlas-session';

const RELATIONSHIP_LABELS: Record<string, string> = {
  single: 'Bekar',
  relationship: 'İlişkisi var',
  married: 'Evli',
  separated: 'Ayrı yaşıyor',
  divorced: 'Boşanmış',
  widowed: 'Dul',
  prefer_not_to_say: 'Belirtmek istemiyorum',
};

const ENERGY_LABELS: Record<string, string> = {
  low: 'Düşük',
  steady: 'Dengeli',
  high: 'Yüksek',
};

function SectionCard({
  title,
  icon: Icon,
  children,
  id,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-[#c9b37a]/80" aria-hidden />
        <h2 className="font-display text-[15px] tracking-wide text-[#e8ecf2]/90">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="atlas-focus mt-3 inline-flex min-h-11 items-center rounded-md border border-white/14 px-4 text-sm text-[#e8ecf2] hover:bg-white/[0.06]"
    >
      Yeniden dene
    </button>
  );
}

function PersonalHeader({
  today,
  profile,
  onJumpProfile,
}: {
  today: PrimeToday | null;
  profile: PrimeProfile | null;
  onJumpProfile: () => void;
}) {
  const name = profile?.displayName || null;
  const isPrime = today?.usage.plan === 'premium' || today?.primeWorld;
  const completeness = today?.profile.completeness;
  const showCta = Boolean(completeness?.showCompleteProfileCta);

  return (
    <header className="rounded-xl border border-[#c9b37a]/20 bg-[#c9b37a]/[0.04] p-5 sm:p-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/70">Lara Prime</p>
      <h1 className="mt-3 font-display text-2xl tracking-wide text-[#e8ecf2] sm:text-3xl">
        {name || 'Kişisel merkezin'}
      </h1>
      <p className="mt-2 text-sm text-[#9aa3b2]">
        {isPrime ? 'Prime üyeliğin aktif.' : 'Hesabın açık. Prime katmanı bazı yüzeyleri genişletir.'}
      </p>
      {today?.greeting ? <p className="mt-3 text-[17px] leading-relaxed text-[#e8ecf2]">{today.greeting}</p> : null}
      {showCta ? (
        <button
          type="button"
          onClick={onJumpProfile}
          className="atlas-focus mt-4 inline-flex min-h-11 items-center rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 text-sm text-[#e8ecf2] hover:bg-[#c9b37a]/16"
        >
          Profilini tamamla
        </button>
      ) : completeness && !completeness.natalHousesAvailable && completeness.hasBirthDate ? (
        <p className="mt-3 text-[13px] text-[#8b93a3]">{today?.profile.note}</p>
      ) : null}
    </header>
  );
}

function TodaySection({
  today,
  loading,
  error,
  onRetry,
}: {
  today: PrimeToday | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <SectionCard title="Bugün" icon={Sparkles} id="today">
        <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>
      </SectionCard>
    );
  }
  if (error) {
    return (
      <SectionCard title="Bugün" icon={Sparkles} id="today">
        <p className="text-sm text-red-300/80">{error}</p>
        <RetryButton onClick={onRetry} />
      </SectionCard>
    );
  }
  if (!today) {
    return (
      <SectionCard title="Bugün" icon={Sparkles} id="today">
        <p className="text-sm text-[#8b93a3]">Bugün için henüz kişisel bir sinyal yok.</p>
      </SectionCard>
    );
  }

  const hasSignal = Boolean(today.natal?.available || today.symbolic.numerology?.available || today.checkIn?.record);

  return (
    <SectionCard title="Bugün" icon={Sparkles} id="today">
      {!hasSignal ? (
        <p className="text-sm text-[#8b93a3]">
          {today.profile.note || 'Profilini veya bugünkü check-in’i tamamladığında burası dolar.'}
        </p>
      ) : null}

      {today.natal?.available ? (
        <p className="mt-1 text-sm text-[#9aa3b2]">
          Güneş burcun: <span className="text-[#e8ecf2]">{today.natal.sunSign}</span>
          {!today.natal.fullChartAvailable ? (
            <span className="block text-[12px] text-[#8b93a3]">
              {today.natal.warnings?.[0] ?? 'Yükselen ve ev bilgileri için doğum saati gerekli.'}
            </span>
          ) : null}
        </p>
      ) : null}

      {today.symbolic.numerology?.available ? (
        <p className="mt-2 text-sm text-[#9aa3b2]">
          Yaşam yolu sayın: <span className="text-[#e8ecf2]">{today.symbolic.numerology.lifePath}</span>
        </p>
      ) : null}

      {today.checkIn?.frequency ? (
        <div className="mt-4 rounded-lg border border-white/[0.06] px-3.5 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b93a3]">Hal</p>
          <p className="mt-1 text-sm text-[#e8ecf2]">
            {today.checkIn.frequency.level} · {today.checkIn.frequency.recommendationLabel}
          </p>
          <p className="mt-1 text-[12px] text-[#8b93a3]">{today.checkIn.frequency.framing}</p>
        </div>
      ) : null}

      {today.profile.note && hasSignal ? <p className="mt-3 text-[13px] text-[#8b93a3]">{today.profile.note}</p> : null}

      <p className="mt-4 text-[12px] text-[#8b93a3]">
        Günlük kullanım: {today.usage.dailyUsed} / {today.usage.dailyLimit}
      </p>
    </SectionCard>
  );
}

function CheckInSection({
  today,
  loading,
  onSaved,
}: {
  today: PrimeToday | null;
  loading: boolean;
  onSaved: () => Promise<void>;
}) {
  const [energy, setEnergy] = useState<PrimeCheckin['energy'] | ''>('');
  const [focus, setFocus] = useState<PrimeCheckin['focus'] | ''>('');
  const [intention, setIntention] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const record = today?.checkIn?.record;
  useEffect(() => {
    if (!record) return;
    setEnergy(record.energy);
    setFocus(record.focus);
    setIntention(record.intention ?? '');
  }, [record]);

  if (loading) {
    return (
      <SectionCard title="Check-in" icon={Sparkles} id="checkin">
        <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>
      </SectionCard>
    );
  }

  if (today && today.primeWorld === false) {
    return (
      <SectionCard title="Check-in" icon={Sparkles} id="checkin">
        <p className="text-sm text-[#8b93a3]">Günlük check-in Lara Prime ile açılır.</p>
        <Link
          to="/lara-prime"
          className="atlas-focus mt-3 inline-flex min-h-11 items-center text-sm text-[#c9b37a]/85 underline-offset-4 hover:underline"
        >
          Lara Prime’a bak →
        </Link>
      </SectionCard>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!energy || !focus) {
      setError('Enerji ve odak gerekli.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitPrimeCheckin({ energy, focus, intention: intention.trim() || null });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title="Check-in" icon={Sparkles} id="checkin">
      {record ? (
        <p className="mb-4 text-sm text-[#9aa3b2]">Bugünkü halin kaydedildi. İstersen güncelleyebilirsin.</p>
      ) : (
        <p className="mb-4 text-sm text-[#8b93a3]">Bugün henüz check-in yok. Üç kısa soru yeter.</p>
      )}
      <form onSubmit={handleSubmit} className="grid gap-4">
        <fieldset>
          <legend className="text-sm text-[#8b93a3]">Enerjin</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ENERGY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEnergy(opt.value)}
                className={`atlas-focus min-h-11 rounded-md border px-4 text-sm ${
                  energy === opt.value
                    ? 'border-[#c9b37a]/50 bg-[#c9b37a]/16 text-[#e8ecf2]'
                    : 'border-white/12 text-[#9aa3b2] hover:bg-white/[0.04]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm text-[#8b93a3]">Bugünkü yönün</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFocus(opt.value)}
                className={`atlas-focus min-h-11 rounded-md border px-4 text-sm ${
                  focus === opt.value
                    ? 'border-[#c9b37a]/50 bg-[#c9b37a]/16 text-[#e8ecf2]'
                    : 'border-white/12 text-[#9aa3b2] hover:bg-white/[0.04]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#8b93a3]">Bugünkü niyetin (isteğe bağlı)</span>
          <input
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            maxLength={200}
            className="atlas-field min-h-11"
            aria-label="Bugünkü niyet"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !energy || !focus}
          className="atlas-focus min-h-11 rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 text-sm text-[#e8ecf2] hover:bg-[#c9b37a]/16 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : record ? 'Güncelle' : 'Kaydet'}
        </button>
        {error ? <p className="text-[12px] text-red-300/80">{error}</p> : null}
      </form>
    </SectionCard>
  );
}

function OutlookSection({ today, loading, error, onRetry }: { today: PrimeToday | null; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <SectionCard title="Önümüzdeki 7 gün" icon={Sparkles} id="outlook">
        <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>
      </SectionCard>
    );
  }
  if (error) {
    return (
      <SectionCard title="Önümüzdeki 7 gün" icon={Sparkles} id="outlook">
        <p className="text-sm text-red-300/80">{error}</p>
        <RetryButton onClick={onRetry} />
      </SectionCard>
    );
  }

  const outlook = today?.outlook;
  if (today && today.primeWorld === false) {
    return (
      <SectionCard title="Önümüzdeki 7 gün" icon={Sparkles} id="outlook">
        <p className="text-sm text-[#8b93a3]">{outlook?.message || '7 günlük görünüm Lara Prime ile açılır.'}</p>
      </SectionCard>
    );
  }
  if (!outlook || !outlook.available || outlook.items.length === 0) {
    return (
      <SectionCard title="Önümüzdeki 7 gün" icon={Sparkles} id="outlook">
        <p className="text-sm text-[#8b93a3]">
          {outlook?.message || 'Önümüzdeki 7 gün için kayıtlı bir madde yok.'}
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Önümüzdeki 7 gün" icon={Sparkles} id="outlook">
      <ul className="space-y-3">
        {outlook.items.map((item) => (
          <li key={`${item.date}-${item.title}`} className="rounded-lg border border-white/[0.06] px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8b93a3]">{item.window}</p>
            <p className="mt-1 text-sm text-[#e8ecf2]">{item.title}</p>
            <p className="mt-1 text-[12px] text-[#8b93a3]">{item.why}</p>
            {item.action ? (
              <Link
                to={item.action.href}
                className="atlas-focus mt-2 inline-flex min-h-11 items-center text-sm text-[#c9b37a]/85 underline-offset-4 hover:underline"
              >
                {item.action.label} →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ContinueSection({ today }: { today: PrimeToday | null }) {
  const previous = today?.checkIn?.previous;
  const continuity = today?.memoryContinuity;

  return (
    <SectionCard title="Devam" icon={MessageCircle} id="continue">
      {today?.continueConversation ? (
        <div>
          <p className="text-sm text-[#e8ecf2]/85 line-clamp-2">{today.continueConversation.preview || 'Sohbet'}</p>
          <p className="mt-1 text-[12px] text-[#8b93a3]">
            {new Date(today.continueConversation.updatedAt).toLocaleString('tr-TR')} · {today.continueConversation.messageCount} mesaj
          </p>
        </div>
      ) : (
        <p className="text-sm text-[#8b93a3]">Henüz bir sohbetin yok.</p>
      )}

      {continuity?.available && continuity.statement ? (
        <p className="mt-3 text-sm text-[#9aa3b2]">{continuity.statement}</p>
      ) : null}

      {previous ? (
        <p className="mt-3 text-[13px] text-[#8b93a3]">
          Son check-in ({previous.date}): {ENERGY_LABELS[previous.energy] || previous.energy}
          {previous.intention ? ` · “${previous.intention}”` : ''}
        </p>
      ) : null}

      <Link
        to="/atlas"
        className="atlas-focus mt-4 inline-flex min-h-11 items-center text-sm text-[#c9b37a]/85 underline-offset-4 hover:underline"
      >
        {today?.continueConversation ? 'Kaldığın yerden devam et →' : 'Atlas ile konuş →'}
      </Link>
    </SectionCard>
  );
}

function ProfileSection({
  profile,
  loading,
  error,
  onSave,
  onRetry,
}: {
  profile: PrimeProfile | null;
  loading: boolean;
  error: string | null;
  onSave: (patch: Parameters<typeof updatePrimeProfile>[0]) => Promise<void>;
  onRetry: () => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [timezone, setTimezone] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? '');
    setBirthDate(profile.birth.date ?? '');
    setBirthTime(profile.birth.time ?? '');
    setBirthPlace(profile.birth.place ?? '');
    setTimezone(profile.birth.timezone ?? '');
    setRelationshipStatus(profile.relationshipStatus ?? '');
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await onSave({
        displayName: displayName.trim() || null,
        birth: {
          date: birthDate || null,
          time: birthTime || null,
          place: birthPlace.trim() || null,
          timezone: timezone.trim() || null,
        },
        relationshipStatus: relationshipStatus || null,
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SectionCard title="Profil" icon={User} id="profile">
        <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>
      </SectionCard>
    );
  }
  if (error) {
    return (
      <SectionCard title="Profil" icon={User} id="profile">
        <p className="text-sm text-red-300/80">{error}</p>
        <RetryButton onClick={onRetry} />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Profil" icon={User} id="profile">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-[#8b93a3]">İsim</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            className="atlas-field min-h-11"
            aria-label="İsim"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#8b93a3]">Doğum tarihi</span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="atlas-field min-h-11"
            aria-label="Doğum tarihi"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#8b93a3]">Doğum saati (bilinmiyorsa boş bırak)</span>
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            className="atlas-field min-h-11"
            aria-label="Doğum saati"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#8b93a3]">Doğum yeri</span>
          <input
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            maxLength={120}
            placeholder="Şehir, Ülke"
            className="atlas-field min-h-11"
            aria-label="Doğum yeri"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#8b93a3]">Saat dilimi</span>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Europe/Istanbul"
            className="atlas-field min-h-11"
            aria-label="Saat dilimi"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-[#8b93a3]">İlişki durumu (istersen boş bırak)</span>
          <select
            value={relationshipStatus}
            onChange={(e) => setRelationshipStatus(e.target.value)}
            className="atlas-field min-h-11"
            aria-label="İlişki durumu"
          >
            <option value="">—</option>
            {RELATIONSHIP_STATUS_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {RELATIONSHIP_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="atlas-focus min-h-11 rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 text-sm text-[#e8ecf2] transition hover:bg-[#c9b37a]/16 disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          {saved ? <span className="ml-3 text-[12px] text-[#9aa3b2]">Kaydedildi.</span> : null}
          {saveError ? <p className="mt-2 text-[12px] text-red-300/80">{saveError}</p> : null}
        </div>
      </form>
    </SectionCard>
  );
}

function MemorySection({
  facts,
  loading,
  error,
  onDelete,
  onRetry,
}: {
  facts: PrimeMemoryFact[] | null;
  loading: boolean;
  error: string | null;
  onDelete: (key: string) => Promise<void>;
  onRetry: () => void;
}) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  async function handleDelete(key: string) {
    setDeletingKey(key);
    try {
      await onDelete(key);
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <SectionCard title="Hafıza" icon={Sparkles} id="memory">
      {loading ? (
        <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>
      ) : error ? (
        <>
          <p className="text-sm text-red-300/80">{error}</p>
          <RetryButton onClick={onRetry} />
        </>
      ) : !facts || facts.length === 0 ? (
        <p className="text-sm text-[#8b93a3]">Henüz kayıtlı hafıza yok.</p>
      ) : (
        <ul className="space-y-2.5">
          {facts.map((f) => (
            <li
              key={f.key}
              className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] px-3.5 py-2.5"
            >
              <span className="text-sm text-[#e8ecf2]/85">{f.value}</span>
              <button
                type="button"
                onClick={() => void handleDelete(f.key)}
                disabled={deletingKey === f.key}
                aria-label={`Sil: ${f.value}`}
                className="atlas-focus min-h-11 min-w-11 shrink-0 text-[#8b93a3] transition hover:text-red-300 disabled:opacity-40"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[12px] leading-5 text-[#8b93a3]">
        Tüm hafızanı ve konuşma geçmişini kalıcı olarak silmek istersen{' '}
        <Link to="/lara-prime" className="underline-offset-2 hover:underline">
          hesap ayarlarından
        </Link>{' '}
        ulaşabilirsin.
      </p>
    </SectionCard>
  );
}

function PrimeHome({ session }: { session: AtlasSessionInfo }) {
  const [today, setToday] = useState<PrimeToday | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [profile, setProfile] = useState<PrimeProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [facts, setFacts] = useState<PrimeMemoryFact[] | null>(null);
  const [factsLoading, setFactsLoading] = useState(true);
  const [factsError, setFactsError] = useState<string | null>(null);

  const loadToday = useCallback(() => {
    setTodayLoading(true);
    setTodayError(null);
    fetchPrimeToday()
      .then(setToday)
      .catch((err) => setTodayError(err instanceof Error ? err.message : 'Yüklenemedi'))
      .finally(() => setTodayLoading(false));
  }, []);

  const loadProfile = useCallback(() => {
    setProfileLoading(true);
    setProfileError(null);
    fetchPrimeProfile()
      .then(setProfile)
      .catch((err) => setProfileError(err instanceof Error ? err.message : 'Yüklenemedi'))
      .finally(() => setProfileLoading(false));
  }, []);

  const loadMemory = useCallback(() => {
    setFactsLoading(true);
    setFactsError(null);
    fetchPrimeMemory()
      .then(setFacts)
      .catch((err) => setFactsError(err instanceof Error ? err.message : 'Yüklenemedi'))
      .finally(() => setFactsLoading(false));
  }, []);

  const loadAll = useCallback(() => {
    loadToday();
    loadProfile();
    loadMemory();
  }, [loadToday, loadProfile, loadMemory]);

  useEffect(() => {
    loadAll();
  }, [loadAll, session.userId]);

  async function handleProfileSave(patch: Parameters<typeof updatePrimeProfile>[0]) {
    const next = await updatePrimeProfile(patch);
    setProfile(next);
    loadToday();
  }

  async function handleMemoryDelete(key: string) {
    await deletePrimeMemoryFact(key);
    setFacts((prev) => (prev ? prev.filter((f) => f.key !== key) : prev));
    loadToday();
  }

  function jumpProfile() {
    document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <CosmicShell transparentNav>
      <main className="mx-auto max-w-xl overflow-x-hidden px-4 pb-24 pt-28 sm:max-w-3xl sm:px-6 md:px-8">
        <PersonalHeader today={today} profile={profile} onJumpProfile={jumpProfile} />

        <div className="mt-6 grid gap-5">
          <TodaySection today={today} loading={todayLoading} error={todayError} onRetry={loadToday} />
          <CheckInSection today={today} loading={todayLoading} onSaved={async () => loadToday()} />
          <OutlookSection today={today} loading={todayLoading} error={todayError} onRetry={loadToday} />
          <ContinueSection today={today} />
          <MemorySection
            facts={facts}
            loading={factsLoading}
            error={factsError}
            onDelete={handleMemoryDelete}
            onRetry={loadMemory}
          />
          <ProfileSection
            profile={profile}
            loading={profileLoading}
            error={profileError}
            onSave={handleProfileSave}
            onRetry={loadProfile}
          />
        </div>
      </main>
    </CosmicShell>
  );
}

export default function PrimePage() {
  return <PrimeRouteGuard>{(session) => <PrimeHome session={session} />}</PrimeRouteGuard>;
}
