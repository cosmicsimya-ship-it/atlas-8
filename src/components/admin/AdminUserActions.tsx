import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../../services/api-client';
import {
  disableUser,
  enableUser,
  eraseUserPersonalData,
  extendPrime,
  fetchAdminUserDetail,
  grantPrime,
  resetUserUsage,
  revokePrime,
  setPrimeExpiry,
  type AdminUserDetail,
} from '../../services/atlas-admin-actions';

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    // 409 "already_active" etc. arrive as ApiError.message from apiRequest's error parsing.
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

// ── Generic confirm dialog — mirrors AuthSessionControl.tsx's dialog language ──
function ConfirmDialog({
  title,
  danger,
  onClose,
  children,
}: {
  title: string;
  danger?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `admin-dialog-${title.replace(/\s+/g, '-').toLowerCase()}`;

  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-[min(100%,420px)] rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className={`text-[15px] font-medium ${danger ? 'text-red-300' : 'text-[#e8ecf2]'}`}>
            {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Kapat" className="atlas-focus text-[#8b93a3] hover:text-[#e8ecf2]">
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-[#8b93a3]">
      Sebep (opsiyonel)
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        className="atlas-field text-sm"
        placeholder="ör. manual support extension"
      />
    </label>
  );
}

function DialogActions({
  submitting,
  onCancel,
  submitLabel,
  danger,
  disabled,
}: {
  submitting: boolean;
  onCancel: () => void;
  submitLabel: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onCancel} disabled={submitting} className="atlas-focus rounded-md border border-white/10 px-3 py-1.5 text-sm text-[#9aa3b2] disabled:opacity-40">
        İptal
      </button>
      <button
        type="submit"
        disabled={submitting || disabled}
        className={`atlas-focus rounded-md px-3 py-1.5 text-sm disabled:opacity-40 ${
          danger ? 'border border-red-400/40 bg-red-500/10 text-red-300' : 'border border-[#c9b37a]/35 bg-[#c9b37a]/10 text-[#e8ecf2]'
        }`}
      >
        {submitting ? 'İşleniyor…' : submitLabel}
      </button>
    </div>
  );
}

const DURATION_PRESETS = [7, 30, 90, 365];

function GrantOrExtendDialog({
  mode,
  userId,
  currentExpiry,
  onClose,
  onDone,
}: {
  mode: 'grant' | 'extend';
  userId: string;
  currentExpiry: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'grant') await grantPrime(userId, duration, reason || undefined);
      else await extendPrime(userId, duration, reason || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err, mode === 'grant' ? 'Prime grant failed.' : 'Prime extend failed.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog title={mode === 'grant' ? 'Grant Prime' : 'Extend Prime'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-[12px] text-[#8b93a3]">
          Target user: <span className="font-mono text-[#9aa3b2]">{userId}</span>
        </p>
        {mode === 'extend' && currentExpiry ? (
          <p className="text-[12px] text-[#8b93a3]">Current expiry: {new Date(currentExpiry).toLocaleString('tr-TR')}</p>
        ) : null}
        <div>
          <p className="mb-1.5 text-[12px] text-[#8b93a3]">{mode === 'grant' ? 'Duration' : 'Extend by'} (days)</p>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`atlas-focus rounded-full border px-2.5 py-1 text-[12px] ${
                  duration === d ? 'border-[#c9b37a]/50 text-[#e8ecf2]' : 'border-white/10 text-[#8b93a3]'
                }`}
              >
                {d}g
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={3650}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="atlas-field mt-2 text-sm"
            aria-label="Gün sayısı"
          />
        </div>
        <ReasonField value={reason} onChange={setReason} />
        {error ? <p className="text-[12px] text-red-300/85">{error}</p> : null}
        <DialogActions submitting={submitting} onCancel={onClose} submitLabel={mode === 'grant' ? 'Grant Prime' : 'Extend Prime'} disabled={!duration || duration <= 0} />
      </form>
    </ConfirmDialog>
  );
}

function SetExpiryDialog({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPast = date ? new Date(date).getTime() < Date.now() : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await setPrimeExpiry(userId, new Date(date).toISOString(), reason || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Set expiry failed.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog title="Set Expiry" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-[12px] text-[#8b93a3]">
          Target user: <span className="font-mono text-[#9aa3b2]">{userId}</span>
        </p>
        <label className="flex flex-col gap-1 text-[12px] text-[#8b93a3]">
          Expiry date
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="atlas-field text-sm" required />
        </label>
        {isPast ? (
          <p className="text-[12px] text-[#c9b37a]">Bu tarih geçmişte olduğu için üyelik expired duruma geçecektir.</p>
        ) : null}
        <ReasonField value={reason} onChange={setReason} />
        {error ? <p className="text-[12px] text-red-300/85">{error}</p> : null}
        <DialogActions submitting={submitting} onCancel={onClose} submitLabel="Set Expiry" disabled={!date} />
      </form>
    </ConfirmDialog>
  );
}

function RevokePrimeDialog({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await revokePrime(userId, reason || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Prime revoke failed.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog title="Revoke Prime" danger onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-[#e8ecf2]/85">
          User: <span className="font-mono text-[13px] text-[#9aa3b2]">{userId}</span>
        </p>
        <p className="text-[13px] text-[#8b93a3]">This will remove Prime access.</p>
        <ReasonField value={reason} onChange={setReason} />
        {error ? <p className="text-[12px] text-red-300/85">{error}</p> : null}
        <DialogActions submitting={submitting} onCancel={onClose} submitLabel="Revoke Prime" danger />
      </form>
    </ConfirmDialog>
  );
}

function UsageResetDialog({
  userId,
  usage,
  onClose,
  onDone,
}: {
  userId: string;
  usage: { dailyUsed: number; dailyLimit: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await resetUserUsage(userId, reason || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Usage reset failed.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog title="Reset Today's Usage" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-[12px] text-[#8b93a3]">
          Target user: <span className="font-mono text-[#9aa3b2]">{userId}</span>
        </p>
        <p className="text-sm text-[#e8ecf2]/85">
          Current usage: {usage.dailyUsed} / {usage.dailyLimit}
        </p>
        <ReasonField value={reason} onChange={setReason} />
        {error ? <p className="text-[12px] text-red-300/85">{error}</p> : null}
        <DialogActions submitting={submitting} onCancel={onClose} submitLabel="Reset Usage" />
      </form>
    </ConfirmDialog>
  );
}

function DisableAccountDialog({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await disableUser(userId, reason || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Account cannot be disabled.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog title="Disable Account" danger onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-[#e8ecf2]/85">
          User: <span className="font-mono text-[13px] text-[#9aa3b2]">{userId}</span>
        </p>
        <p className="text-[13px] text-[#8b93a3]">
          Bu kullanıcı yeni oturum açamaz ve mevcut session yenilemesi account_disabled ile reddedilir.
        </p>
        <ReasonField value={reason} onChange={setReason} />
        {error ? <p className="text-[12px] text-red-300/85">{error}</p> : null}
        <DialogActions submitting={submitting} onCancel={onClose} submitLabel="Disable Account" danger />
      </form>
    </ConfirmDialog>
  );
}

const ERASE_SCOPE_ITEMS = ['memory/profile/preferences', 'prime check-ins', 'conversations'];

function EraseDataDialog({
  userId,
  identifier,
  onClose,
  onDone,
}: {
  userId: string;
  identifier: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === identifier;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    setSubmitting(true);
    setError(null);
    try {
      await eraseUserPersonalData(userId, reason || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Erase failed.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog title="Erase Personal Data" danger onClose={onClose}>
      {step === 1 ? (
        <div className="space-y-3">
          <p className="text-sm text-[#e8ecf2]/85">
            This will permanently erase the user’s stored memory/profile data and conversation history.
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-[#9aa3b2]">
            {ERASE_SCOPE_ITEMS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="text-[12px] text-[#8b93a3]">Account silinmiyor. Subscription silinmiyor. This action is irreversible.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="atlas-focus rounded-md border border-white/10 px-3 py-1.5 text-sm text-[#9aa3b2]">
              İptal
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="atlas-focus rounded-md border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-300"
            >
              Devam et
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-[13px] text-[#8b93a3]">
            Confirm by typing: <span className="font-mono text-[#e8ecf2]">{identifier}</span>
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="atlas-field text-sm"
            aria-label={`Type ${identifier} to confirm`}
            autoFocus
          />
          <ReasonField value={reason} onChange={setReason} />
          {error ? <p className="text-[12px] text-red-300/85">{error}</p> : null}
          <DialogActions submitting={submitting} onCancel={onClose} submitLabel="Erase Personal Data" danger disabled={!matches} />
        </form>
      )}
    </ConfirmDialog>
  );
}

function EnableAccountAction({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setSubmitting(true);
    setError(null);
    try {
      await enableUser(userId);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Account cannot be enabled.'));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={submitting}
        className="atlas-focus rounded-md border border-white/10 px-3 py-1.5 text-sm text-[#e8ecf2] disabled:opacity-40"
      >
        {submitting ? 'İşleniyor…' : 'Enable Account'}
      </button>
      {error ? <p className="mt-1.5 text-[12px] text-red-300/85">{error}</p> : null}
    </div>
  );
}

type DialogKind = 'grant' | 'extend' | 'expiry' | 'revoke' | 'usage-reset' | 'disable' | 'erase' | null;

/**
 * User Detail — Actions section. Buttons shown depend on real subscription
 * state (section 2 of the brief): free/inactive -> Grant only; active ->
 * Extend/Set Expiry/Revoke; expired -> Grant/Extend/Set Expiry.
 */
export default function AdminUserActions({ userId, actorUserId }: { userId: string; actorUserId: string }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    fetchAdminUserDetail(userId)
      .then(setDetail)
      .catch((err) => setLoadError(errorMessage(err, 'User not found.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function closeDialog() {
    setDialog(null);
  }
  function onActionDone(message: string) {
    setDialog(null);
    setSuccessMessage(message);
    refresh(); // authoritative refresh, never optimistic local state
  }

  if (loading) return <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>;
  if (loadError || !detail) return <p className="text-sm text-red-300/80">{loadError ?? 'User not found.'}</p>;

  const isActivePrime = detail.plan === 'premium' && detail.subscriptionStatus === 'active';
  const isExpired = detail.subscriptionStatus === 'expired' || detail.subscriptionStatus === 'canceled';
  const isFreeOrInactive = !isActivePrime && !isExpired;
  const isSelf = userId === actorUserId;
  const identifier = detail.email || detail.username || detail.userId;

  return (
    <div className="mt-6 space-y-6">
      {successMessage ? (
        <p className="rounded-md border border-[#c9b37a]/25 bg-[#c9b37a]/5 px-3 py-2 text-[13px] text-[#c9b37a]">{successMessage}</p>
      ) : null}

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Prime Management</p>
        {detail.subscription?.provider === 'admin_manual' ? (
          <p className="mb-2 text-[11px] text-[#8b93a3]">Manual Admin Grant</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {(isFreeOrInactive || isExpired) && <button type="button" onClick={() => setDialog('grant')} className="atlas-focus rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-3 py-1.5 text-sm text-[#e8ecf2]">Grant Prime</button>}
          {(isActivePrime || isExpired) && <button type="button" onClick={() => setDialog('extend')} className="atlas-focus rounded-md border border-white/10 px-3 py-1.5 text-sm text-[#e8ecf2]">Extend Prime</button>}
          {(isActivePrime || isExpired) && <button type="button" onClick={() => setDialog('expiry')} className="atlas-focus rounded-md border border-white/10 px-3 py-1.5 text-sm text-[#e8ecf2]">Set Expiry</button>}
          {isActivePrime && <button type="button" onClick={() => setDialog('revoke')} className="atlas-focus rounded-md border border-red-400/30 px-3 py-1.5 text-sm text-red-300">Revoke Prime</button>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Usage</p>
        <p className="mb-2 text-[13px] text-[#9aa3b2]">{detail.usageToday.dailyUsed} / {detail.usageToday.dailyLimit}</p>
        <button type="button" onClick={() => setDialog('usage-reset')} className="atlas-focus rounded-md border border-white/10 px-3 py-1.5 text-sm text-[#e8ecf2]">
          Reset Today's Usage
        </button>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Account</p>
        {detail.disabled ? (
          <EnableAccountAction userId={userId} onDone={() => onActionDone('Account enabled')} />
        ) : (
          <button
            type="button"
            onClick={() => setDialog('disable')}
            disabled={isSelf}
            title={isSelf ? 'Cannot disable your own account' : undefined}
            className="atlas-focus rounded-md border border-red-400/30 px-3 py-1.5 text-sm text-red-300 disabled:opacity-40"
          >
            Disable Account
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Privacy</p>
        <button type="button" onClick={() => setDialog('erase')} className="atlas-focus rounded-md border border-red-400/30 px-3 py-1.5 text-sm text-red-300">
          Erase Personal Data
        </button>
      </div>

      {dialog === 'grant' && <GrantOrExtendDialog mode="grant" userId={userId} currentExpiry={null} onClose={closeDialog} onDone={() => onActionDone('Prime granted')} />}
      {dialog === 'extend' && <GrantOrExtendDialog mode="extend" userId={userId} currentExpiry={detail.subscription?.currentPeriodEnd ?? null} onClose={closeDialog} onDone={() => onActionDone('Prime extended')} />}
      {dialog === 'expiry' && <SetExpiryDialog userId={userId} onClose={closeDialog} onDone={() => onActionDone('Expiry updated')} />}
      {dialog === 'revoke' && <RevokePrimeDialog userId={userId} onClose={closeDialog} onDone={() => onActionDone('Prime revoked')} />}
      {dialog === 'usage-reset' && <UsageResetDialog userId={userId} usage={detail.usageToday} onClose={closeDialog} onDone={() => onActionDone('Usage reset')} />}
      {dialog === 'disable' && <DisableAccountDialog userId={userId} onClose={closeDialog} onDone={() => onActionDone('Account disabled')} />}
      {dialog === 'erase' && <EraseDataDialog userId={userId} identifier={identifier} onClose={closeDialog} onDone={() => onActionDone('Personal data erased')} />}
    </div>
  );
}
