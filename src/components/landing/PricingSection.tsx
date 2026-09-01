import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

import { landingPricing } from '../../data/landing-content';
import { fetchBillingConfig, type AtlasBillingConfig } from '../../services/atlas-billing';
import { trackEvent } from '../../services/atlas-analytics';

/**
 * Landing pricing teaser.
 *
 * Single source of truth: this reads the exact same `/api/billing/config`
 * response that PremiumPlanPanel and LaraPrimePage already render from
 * (server/entitlements/pricing.js → server/billing/config.js). No price is
 * ever hardcoded on the frontend — if the server config is empty, this
 * shows the same honest fallback copy used elsewhere in the product.
 */
export default function PricingSection() {
  const { id, eyebrow, title, free, prime } = landingPricing;
  const [config, setConfig] = useState<AtlasBillingConfig | null>(null);

  useEffect(() => {
    trackEvent('pricing_viewed');
  }, []);

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

  const primePriceLabel = config?.product?.displayPrice
    ? `${config.product.displayPrice} / ay`
    : null;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24" aria-labelledby="pricing-title">
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#c9b37a]/65">{eyebrow}</p>
        <h2
          id="pricing-title"
          className="mt-4 max-w-2xl font-display text-[clamp(1.85rem,4vw,2.85rem)] font-medium leading-[1.12] tracking-[-0.02em] text-[#f5f0e6]"
        >
          {title}
        </h2>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#9a9488] sm:text-base sm:leading-8">
          Sohbet, sembolik analiz ve ses/müzik yükleme her iki planda da aynı şekilde çalışır.
          İstersen Lara Prime ile daha kişisel bir katmana geçebilirsin.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <div className="atlas-glass-card p-6 sm:p-7">
            <p className="font-display text-sm tracking-[0.12em] text-[#f5f0e6]/90">{free.label}</p>
            <p className="mt-3 font-display text-2xl tracking-wide text-[#f5f0e6]">{free.price}</p>
            <ul className="mt-6 space-y-2.5 text-[13px] leading-6 text-[#e8e2d6]/80">
              {free.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-[#9a9488]" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link to={free.cta.to} className="atlas-btn-secondary mt-7 w-full sm:w-auto">
              {free.cta.label}
            </Link>
          </div>

          <div className="atlas-glass-card border-[#c9b37a]/25 p-6 sm:p-7">
            <p className="font-display text-sm tracking-[0.12em] text-[#c9b37a]/85">{prime.label}</p>
            {primePriceLabel ? (
              <p className="mt-3 font-display text-2xl tracking-wide text-[#f5f0e6]">{primePriceLabel}</p>
            ) : (
              <p className="mt-3 text-[13px] text-[#9a9488]">Prime fiyatlandırması yakında burada.</p>
            )}
            <ul className="mt-6 space-y-2.5 text-[13px] leading-6 text-[#e8e2d6]">
              {prime.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-[#c9b37a]/80" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link to={prime.cta.to} className="atlas-btn-gold mt-7 w-full sm:w-auto">
              {prime.cta.label}
            </Link>
          </div>
        </div>

        <p className="mt-6 text-[12px] leading-5 text-[#6f6a60]">
          Güncel tutar ödeme adımında doğrulanır.
        </p>
      </div>
    </section>
  );
}
