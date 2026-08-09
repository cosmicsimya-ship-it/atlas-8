/**
 * Minimal Atlas Premium panel — uses Cosmic Simya visual language.
 * Does not start live payment unless server reports liveCheckoutEnabled.
 */

import { useEffect, useState } from 'react';
import {
  fetchBillingConfig,
  startPremiumCheckout,
  type AtlasBillingConfig,
} from '../../services/atlas-billing';
import { fetchEntitlements } from '../../services/atlas-entitlements';

export default function PremiumPlanPanel({
  plan,
  hasLara,
  onClose,
}: {
  plan?: string | null;
  hasLara?: boolean;
  onClose?: () => void;
}) {
  const [config, setConfig] = useState<AtlasBillingConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPremium = plan === 'premium';

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

  async function onCheckout() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await startPremiumCheckout();
      if (!result.ok) {
        setError(result.error?.message || 'Checkout başlatılamadı.');
        return;
      }
      if (result.dryRun || !result.liveCheckoutEnabled) {
        setMessage(
          'Premium ödeme altyapısı hazır (test/dry-run). Canlı ücretlendirme bu ortamda kapalı.',
        );
        return;
      }
      setMessage(result.message || 'Ödeme sayfasına yönlendiriliyorsunuz…');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout hatası.');
    } finally {
      setBusy(false);
      try {
        await fetchEntitlements();
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm tracking-[0.12em] text-[#e8ecf2]/90">
            ATLAS PREMIUM
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9aa3b2]">
            {isPremium
              ? 'Aktif plan · Lara Voice dahil'
              : 'Lara Voice ve Premium özellikler'}
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
        {(config?.features || [
          'Lara Voice',
          'Türkçe sesli yanıt',
          'İngilizce sesli yanıt',
          'Premium özellikler',
        ]).map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>

      {priceLabel ? (
        <p className="mt-3 text-xs text-[#e8ecf2]/85">{priceLabel}</p>
      ) : (
        <p className="mt-3 text-[11px] text-[#9aa3b2]">Fiyat sunucu yapılandırmasından gelir.</p>
      )}

      {isPremium ? (
        <p className="mt-3 text-[11px] text-[#9aa3b2]">
          Plan: Premium
          {hasLara ? ' · Lara Voice' : ''}
          {' · '}
          Subscription active
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onCheckout}
          className="mt-3 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-[#e8ecf2] transition hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? 'Hazırlanıyor…' : "Premium'a Geç"}
        </button>
      )}

      {message ? <p className="mt-2 text-[11px] text-[#9aa3b2]">{message}</p> : null}
      {error ? <p className="mt-2 text-[11px] text-rose-300/90">{error}</p> : null}
    </div>
  );
}
