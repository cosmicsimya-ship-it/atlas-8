/**
 * Compact Lara Prime panel — Cosmic Simya visual language.
 * Internal plan remains `premium`. Checkout body stays empty (server owns price).
 * Live sandbox: navigates to provider paymentPageUrl (no iframe invention).
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchBillingConfig,
  isSafePaymentPageUrl,
  startPremiumCheckout,
  type AtlasBillingConfig,
} from '../../services/atlas-billing';
import { ensureAtlasSession } from '../../utils/atlas-session';

type PanelState = 'idle' | 'initializing' | 'redirecting' | 'dry-run' | 'error';

export default function PremiumPlanPanel({
  plan,
  hasLara,
  onClose,
  onEntitlementsChange,
}: {
  plan?: string | null;
  hasLara?: boolean;
  onClose?: () => void;
  onEntitlementsChange?: () => void | Promise<void>;
}) {
  const [config, setConfig] = useState<AtlasBillingConfig | null>(null);
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkoutLock = useRef(false);
  const isPrime = plan === 'premium';
  const busy = panelState === 'initializing' || panelState === 'redirecting';

  useEffect(() => {
    let cancelled = false;
    fetchBillingConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const priceLabel = config?.product?.displayPrice
    ? `${config.product.displayPrice} / ay`
    : null;

  async function refreshLocalAuth() {
    try {
      await ensureAtlasSession();
      await onEntitlementsChange?.();
    } catch {
      /* ignore — result page / next session load will refresh */
    }
  }

  async function onCheckout() {
    if (checkoutLock.current || busy || isPrime) return;
    checkoutLock.current = true;
    setPanelState('initializing');
    setError(null);
    setMessage(null);
    try {
      // Empty body only — never send amount/currency/tier from client.
      const result = await startPremiumCheckout();
      if (!result.ok) {
        setPanelState('error');
        setError(result.error?.message || 'Checkout başlatılamadı.');
        checkoutLock.current = false;
        return;
      }

      if (result.dryRun || !result.liveCheckoutEnabled) {
        setPanelState('dry-run');
        setMessage(
          'Lara Prime ödeme altyapısı hazır (test/dry-run). Canlı sandbox bu ortamda kapalı.',
        );
        await refreshLocalAuth();
        checkoutLock.current = false;
        return;
      }

      const url = result.paymentPageUrl;
      if (!isSafePaymentPageUrl(url)) {
        setPanelState('error');
        setError(
          'Ödeme sayfası alınamadı. Canlı checkout yanıtında güvenli paymentPageUrl yok.',
        );
        checkoutLock.current = false;
        return;
      }

      setPanelState('redirecting');
      setMessage('Ödeme sayfasına yönlendiriliyorsunuz…');
      // Keep lock through navigation; page unload clears it.
      window.location.assign(String(url));
    } catch (e) {
      setPanelState('error');
      setError(e instanceof Error ? e.message : 'Checkout hatası.');
      checkoutLock.current = false;
    }
  }

  const buttonLabel =
    panelState === 'initializing'
      ? 'Hazırlanıyor…'
      : panelState === 'redirecting'
        ? 'Yönlendiriliyor…'
        : 'Lara Prime’a Geç';

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm tracking-[0.12em] text-[#e8ecf2]/90">
            LARA PRIME
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9aa3b2]">
            {isPrime
              ? 'Aktif üyelik · Lara Voice dahil'
              : 'Atlas’ın ayrıcalıklı deneyimi · Lara Voice'}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[#9aa3b2] hover:text-[#e8ecf2]"
          >
            Kapat
          </button>
        ) : null}
      </div>

      <ul className="mt-3 space-y-1 text-[11px] text-[#c5ccd8]">
        {(config?.features || ['Lara Voice', 'Türkçe sesli yanıt', 'İngilizce sesli yanıt']).map(
          (f) => (
            <li key={f}>· {f}</li>
          ),
        )}
      </ul>

      {priceLabel ? (
        <p className="mt-3 text-xs text-[#e8ecf2]/85">{priceLabel}</p>
      ) : (
        <p className="mt-3 text-[11px] text-[#9aa3b2]">Fiyat sunucu yapılandırmasından gelir.</p>
      )}

      {isPrime ? (
        <p className="mt-3 text-[11px] text-[#9aa3b2]">
          Lara Prime aktif
          {hasLara ? ' · Lara Voice' : ''}
          {' · '}
          Dönem aktif
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onCheckout}
          className="mt-3 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-[#e8ecf2] transition hover:bg-white/10 disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      )}

      <Link
        to="/lara-prime"
        className="mt-2 inline-block text-[11px] text-[#9aa3b2] underline-offset-2 hover:text-[#e8ecf2] hover:underline"
        onClick={onClose}
      >
        Lara Prime sayfası
      </Link>

      {message ? <p className="mt-2 text-[11px] text-[#9aa3b2]">{message}</p> : null}
      {error ? <p className="mt-2 text-[11px] text-rose-300/90">{error}</p> : null}
    </div>
  );
}
