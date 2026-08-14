import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Sparkles, Trash2, User } from 'lucide-react';

import CosmicShell from '../components/cosmic/CosmicShell';
import PrimeRouteGuard from '../components/prime/PrimeRouteGuard';
import {
  RELATIONSHIP_STATUS_OPTIONS,
  deletePrimeMemoryFact,
  fetchPrimeMemory,
  fetchPrimeProfile,
  fetchPrimeToday,
  updatePrimeProfile,
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

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-[#c9b37a]/80" aria-hidden />
        <h2 className="font-display text-[15px] tracking-wide text-[#e8ecf2]/90">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TodaySection({ today, loading, error }: { today: PrimeToday | null; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <SectionCard title="Bugün" icon={Sparkles}>
        <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>
      </SectionCard>
    );
  }
  if (error) {
    return (
      <SectionCard title="Bugün" icon={Sparkles}>
        <p className="text-sm text-red-300/80">{error}</p>
      </SectionCard>
    );
  }
  if (!today) return null;

  return (
    <SectionCard title="Bugün" icon={Sparkles}>
      <p className="text-[17px] leading-relaxed text-[#e8ecf2]">{today.greeting}</p>

      {today.natal?.available ? (
        <p className="mt-3 text-sm text-[#9aa3b2]">
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

      {today.profile.note ? <p className="mt-3 text-[13px] text-[#8b93a3]">{today.profile.note}</p> : null}

      <p className="mt-4 text-[12px] text-[#8b93a3]">
        Günlük kullanım: {today.usage.dailyUsed} / {today.usage.dailyLimit}
      </p>
    </SectionCard>
  );
}

function ContinueConversationSection({ today }: { today: PrimeToday | null }) {
  return (
    <SectionCard title="Son konuşmana devam et" icon={MessageCircle}>
      {today?.continueConversation ? (
        <div>
          <p className="text-sm text-[#e8ecf2]/85 line-clamp-2">{today.continueConversation.preview || 'Sohbet'}</p>
          <p className="mt-1 text-[12px] text-[#8b93a3]">
            {new Date(today.continueConversation.updatedAt).toLocaleString('tr-TR')} · {today.continueConversation.messageCount} mesaj
          </p>
          <Link
            to="/atlas"
            className="atlas-focus mt-3 inline-flex text-sm text-[#c9b37a]/85 underline-offset-4 hover:underline"
          >
            Devam et →
          </Link>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[#8b93a3]">Henüz bir sohbetin yok.</p>
          <Link to="/atlas" className="atlas-focus mt-3 inline-flex text-sm text-[#c9b37a]/85 underline-offset-4 hover:underline">
            Atlas ile konuş →
          </Link>
        </div>
      )}
    </SectionCard>
  );
}

function ProfileSection({
  profile,
  loading,
  error,
  onSave,
}: {
  profile: PrimeProfile | null;
  loading: boolean;
  error: string | null;
  onSave: (patch: Parameters<typeof updatePrimeProfile>[0]) => Promise<void>;
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
          time: birthTime || null, // unknown birth time is a valid, honest state
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
      <SectionCard title="Profil" icon={User}>
        <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>
      </SectionCard>
    );
  }
  if (error) {
    return (
      <SectionCard title="Profil" icon={User}>
        <p className="text-sm text-red-300/80">{error}</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Profil" icon={User}>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-[#8b93a3]">İsim</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            className="atlas-field"
            aria-label="İsim"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#8b93a3]">Doğum tarihi</span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="atlas-field"
            aria-label="Doğum tarihi"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#8b93a3]">Doğum saati (bilinmiyorsa boş bırak)</span>
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            className="atlas-field"
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
            className="atlas-field"
            aria-label="Doğum yeri"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#8b93a3]">Saat dilimi</span>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Europe/Istanbul"
            className="atlas-field"
            aria-label="Saat dilimi"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-[#8b93a3]">İlişki durumu (istersen boş bırak)</span>
          <select
            value={relationshipStatus}
            onChange={(e) => setRelationshipStatus(e.target.value)}
            className="atlas-field"
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
            className="atlas-focus rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 py-2 text-sm text-[#e8ecf2] transition hover:bg-[#c9b37a]/16 disabled:opacity-50"
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
}: {
  facts: PrimeMemoryFact[] | null;
  loading: boolean;
  error: string | null;
  onDelete: (key: string) => Promise<void>;
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
    <SectionCard title="Hafıza" icon={Sparkles}>
      {loading ? (
        <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>
      ) : error ? (
        <p className="text-sm text-red-300/80">{error}</p>
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
                className="atlas-focus shrink-0 text-[#8b93a3] transition hover:text-red-300 disabled:opacity-40"
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

  const loadAll = useCallback(() => {
    setTodayLoading(true);
    fetchPrimeToday()
      .then(setToday)
      .catch((err) => setTodayError(err instanceof Error ? err.message : 'Yüklenemedi'))
      .finally(() => setTodayLoading(false));

    setProfileLoading(true);
    fetchPrimeProfile()
      .then(setProfile)
      .catch((err) => setProfileError(err instanceof Error ? err.message : 'Yüklenemedi'))
      .finally(() => setProfileLoading(false));

    setFactsLoading(true);
    fetchPrimeMemory()
      .then(setFacts)
      .catch((err) => setFactsError(err instanceof Error ? err.message : 'Yüklenemedi'))
      .finally(() => setFactsLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll, session.userId]);

  async function handleProfileSave(patch: Parameters<typeof updatePrimeProfile>[0]) {
    const next = await updatePrimeProfile(patch);
    setProfile(next);
    fetchPrimeToday().then(setToday).catch(() => undefined);
  }

  async function handleMemoryDelete(key: string) {
    await deletePrimeMemoryFact(key);
    setFacts((prev) => (prev ? prev.filter((f) => f.key !== key) : prev));
  }

  return (
    <CosmicShell transparentNav>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/70">Lara Prime</p>
        <h1 className="mt-3 font-display text-2xl tracking-wide text-[#e8ecf2] sm:text-3xl">Kişisel merkezin</h1>

        <nav
          aria-label="Prime bölümleri"
          className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-white/[0.08] pb-4 text-[13px]"
        >
          <a href="#top" className="text-[#e8ecf2]/90 hover:text-[#c9b37a]">Bugün</a>
          <Link to="/atlas" className="text-[#9aa3b2] hover:text-[#e8ecf2]">Atlas</Link>
          <Link to="/archive" className="text-[#9aa3b2] hover:text-[#e8ecf2]">Arşiv</Link>
          <a href="#memory" className="text-[#9aa3b2] hover:text-[#e8ecf2]">Hafıza</a>
          <span className="text-[#8b93a3]/50" aria-disabled="true" title="Yakında">Yankı</span>
          <span className="text-[#8b93a3]/50" aria-disabled="true" title="Yakında">Kozmik</span>
          <a href="#profile" className="text-[#9aa3b2] hover:text-[#e8ecf2]">Profil</a>
        </nav>

        <div id="top" className="mt-8 grid gap-5">
          <TodaySection today={today} loading={todayLoading} error={todayError} />
          <div id="continue">
            <ContinueConversationSection today={today} />
          </div>
          <div id="profile">
            <ProfileSection profile={profile} loading={profileLoading} error={profileError} onSave={handleProfileSave} />
          </div>
          <div id="memory">
            <MemorySection facts={facts} loading={factsLoading} error={factsError} onDelete={handleMemoryDelete} />
          </div>
        </div>
      </main>
    </CosmicShell>
  );
}

export default function PrimePage() {
  return <PrimeRouteGuard>{(session) => <PrimeHome session={session} />}</PrimeRouteGuard>;
}
