import { useEffect, useState } from 'react';
import { Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { useVoicePlayback } from './useVoicePlayback';
import {
  fetchEntitlements,
  hasEntitlement,
  type AtlasEntitlementsPayload,
} from '../../services/atlas-entitlements';
import { ApiError } from '../../services/api-client';

type VoicePlaybackControlsProps = {
  text: string;
  voice?: string;
  language?: string;
  className?: string;
  label?: string;
};

type EntitlementLoadState = 'loading' | 'ready' | 'error';

/**
 * Minimal play / pause / replay controls for Atlas TTS.
 * Client UX gates Premium; server enforces voice.lara (never rely on UI alone).
 */
export default function VoicePlaybackControls({
  text,
  voice = 'lara',
  language = 'tr-TR',
  className = '',
  label = 'Dinle',
}: VoicePlaybackControlsProps) {
  const { state, error, play, pause, replay, isLoading, isPlaying } = useVoicePlayback({
    voice,
    language,
  });
  const [entitlements, setEntitlements] = useState<AtlasEntitlementsPayload | null>(null);
  const [loadState, setLoadState] = useState<EntitlementLoadState>('loading');
  const [premiumHint, setPremiumHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    fetchEntitlements()
      .then((data) => {
        if (cancelled) return;
        setEntitlements(data);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setEntitlements(null);
        // Fail closed: do not call provider until entitlement is known
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canLara = loadState === 'ready' && hasEntitlement(entitlements, 'voice.lara');
  const pricingLabel = entitlements?.pricing?.displayPrice
    ? ` (${entitlements.pricing.displayPrice}/ay)`
    : '';

  const trimmed = text.trim();
  if (!trimmed) return null;

  async function onPlayClick() {
    setPremiumHint(null);

    if (loadState === 'loading') {
      setPremiumHint('Yetki kontrol ediliyor…');
      return;
    }

    if (loadState === 'error' || !canLara) {
      setPremiumHint(`Lara Voice, Lara Prime kapsamında sunulur${pricingLabel}.`);
      return;
    }

    try {
      await play(trimmed);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPremiumHint('Lara Voice, Lara Prime kapsamında sunulur.');
      }
    }
  }

  const displayError =
    premiumHint ||
    (error && /premium/i.test(error) ? 'Lara Voice, Lara Prime kapsamında sunulur.' : error);

  const playDisabled = isLoading || loadState === 'loading';

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <div className="inline-flex items-center gap-1.5">
        {isPlaying ? (
          <button
            type="button"
            onClick={() => pause()}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--text-secondary,#a8a29e)] hover:text-[var(--text-primary,#fafaf9)] transition-colors"
            aria-label="Duraklat"
          >
            <Pause className="h-3.5 w-3.5" />
            Duraklat
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onPlayClick()}
            disabled={playDisabled}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--text-secondary,#a8a29e)] hover:text-[var(--text-primary,#fafaf9)] transition-colors disabled:opacity-50"
            aria-label={label}
          >
            {isLoading || loadState === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isLoading || loadState === 'loading' ? 'Hazırlanıyor…' : label}
          </button>
        )}
        {(state === 'paused' || state === 'idle') && canLara ? (
          <button
            type="button"
            onClick={() => void replay()}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-[var(--text-secondary,#a8a29e)] hover:text-[var(--text-primary,#fafaf9)] transition-colors"
            aria-label="Yeniden oynat"
            title="Yeniden oynat"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {displayError ? (
        <span className="text-[11px] text-red-400/90" role="alert">
          {displayError}
        </span>
      ) : null}
    </div>
  );
}
