import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { resolveDiscoveredModules } from '../../data/capability-discovery';
import {
  capabilityStatusLabel,
  type CapabilityModule,
  type CapabilityModuleId,
} from '../../data/atlas-capabilities';
import { cn } from '../../utils/cn';

type Props = {
  /** Completed user messages that already received an assistant reply */
  completedExchanges: number;
  userTexts: string[];
};

/**
 * Progressive capability disclosure — incomplete ontology UI.
 * Hidden in production unless `VITE_CAPABILITY_DISCOVERY=true`.
 * Renders nothing until the user has spoken and Atlas has answered.
 * Never shows the full feature map.
 */
export function isCapabilityDiscoveryEnabled(): boolean {
  const raw = String(import.meta.env.VITE_CAPABILITY_DISCOVERY ?? '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

export default function CapabilityDiscovery({ completedExchanges, userTexts }: Props) {
  const reduced = useReducedMotion();
  const location = useLocation();
  const [openId, setOpenId] = useState<CapabilityModuleId | null>(null);

  const discovered = useMemo(() => {
    if (!isCapabilityDiscoveryEnabled()) return [];
    const modules = resolveDiscoveredModules(completedExchanges, userTexts);
    return modules.filter(
      (mod) =>
        Array.isArray(mod.capabilities) &&
        mod.capabilities.length > 0 &&
        Boolean(mod.title?.trim()),
    );
  }, [completedExchanges, userTexts]);

  if (!isCapabilityDiscoveryEnabled() || discovered.length === 0) return null;

  const openModule: CapabilityModule | null =
    discovered.find((m) => m.id === openId) ?? null;

  return (
    <div className="mt-6 border-t border-white/[0.05] pt-5" aria-live="polite">
      <p className="mb-3 text-[13px] text-[#6e7888]">
        Konuşurken açılan yollar
      </p>

      <div className="flex flex-wrap gap-2">
        {discovered.map((mod) => {
          const active = openId === mod.id;
          return (
            <motion.button
              key={mod.id}
              type="button"
              layout
              onClick={() => setOpenId(active ? null : mod.id)}
              aria-expanded={active}
              className={cn(
                'site-focus rounded-full px-4 py-2.5 text-left transition duration-200',
                active
                  ? 'bg-[rgba(126,182,255,0.08)] text-[#e8ecf2]'
                  : 'text-[#9aa3b0] hover:bg-white/[0.04] hover:text-[#d2d8e0]',
              )}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="text-[13px] font-medium">{mod.title}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {openModule && openModule.capabilities.some((cap) => Boolean(cap?.name?.trim())) ? (
          <motion.div
            key={openModule.id}
            role="region"
            aria-label={openModule.title}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 4 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 space-y-3"
          >
            {openModule.purpose?.trim() ? (
              <p className="text-[14px] leading-[1.7] text-[#8b93a3]">{openModule.purpose}</p>
            ) : null}
            <ul className="space-y-3">
              {openModule.capabilities
                .filter((cap) => Boolean(cap?.name?.trim()))
                .map((cap) => {
                  // A link back to the surface you are already on is a dead end.
                  const href = cap.href && cap.href !== location.pathname ? cap.href : null;
                  return (
                    <li
                      key={cap.id}
                      className="flex items-start justify-between gap-4 border-t border-white/[0.04] pt-3 first:border-t-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[#d2d8e0]">{cap.name}</p>
                        {cap.micro?.trim() ? (
                          <p className="mt-0.5 text-[13px] leading-[1.6] text-[#6e7888]">{cap.micro}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {cap.status !== 'live' && (
                          <span className="text-[11px] text-[#5c6573]">
                            {capabilityStatusLabel[cap.status]}
                          </span>
                        )}
                        {href ? (
                          <Link
                            to={href}
                            className="site-focus text-[13px] text-[#7eb6ff] underline-offset-2 transition duration-200 hover:text-[#9ccaff] hover:underline"
                          >
                            Devam et
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
