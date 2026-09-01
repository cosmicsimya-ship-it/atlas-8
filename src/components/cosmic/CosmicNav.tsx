import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '../../utils/cn';
import AuthSessionControl from './AuthSessionControl';

const NAV_ITEMS: Array<{ to: string; label: string; accent?: boolean }> = [
  { to: '/', label: 'Ana Sayfa' },
  { to: '/atlas', label: 'Atlas' },
  { to: '/analysis/symbolic', label: 'Sembolik Analiz' },
  { to: '/analysis', label: 'Analiz' },
  { to: '/archive', label: 'Arşiv' },
  { to: '/lara-prime', label: 'Lara Prime', accent: true },
  { to: '/about', label: 'Hakkında' },
];

/** Primary product nav — shared by chatMode desktop + all mobile menus. */
const PRIMARY_NAV_PATHS = ['/', '/atlas', '/lara-prime', '/archive'] as const;

/** Leaf surfaces that must exact-match; avoids dual-active via prefix/substring. */
const EXACT_ACTIVE_PATHS = new Set<string>([
  '/',
  '/atlas',
  '/lara-prime',
  '/archive',
  '/analysis',
  '/about',
]);

function resolveNavItems(paths: readonly string[]) {
  return paths
    .map((to) => NAV_ITEMS.find((item) => item.to === to))
    .filter((item): item is (typeof NAV_ITEMS)[number] => Boolean(item));
}

interface CosmicNavProps {
  transparent?: boolean;
  chatMode?: boolean;
}

export default function CosmicNav({ transparent = false, chatMode = false }: CosmicNavProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const solid = scrolled || !transparent || open;
  const quiet = chatMode && !scrolled && !open;

  const primaryItems = resolveNavItems(PRIMARY_NAV_PATHS);
  const desktopItems = chatMode ? primaryItems : NAV_ITEMS;
  const mobileItems = primaryItems;

  const isActive = (to: string) =>
    EXACT_ACTIVE_PATHS.has(to)
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500',
        quiet
          ? 'border-b border-transparent bg-transparent'
          : solid
            ? 'border-b border-white/[0.07] bg-[#030304]/90 backdrop-blur-xl'
            : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="atlas-focus group flex shrink-0 items-center gap-2.5 rounded-sm"
          aria-label="ATLAS ana sayfa"
        >
          <img
            src="/atlas-north-star.png"
            alt=""
            className="h-8 w-8 shrink-0 object-contain opacity-90 drop-shadow-[0_0_16px_rgba(226,230,236,0.08)]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="atlas-mark atlas-mark-sm atlas-mark-nav block leading-none text-transparent">
              ATLAS
            </span>
            {!chatMode && (
              <span className="mt-1 block text-[9px] uppercase tracking-[0.28em] text-[#9aa3ae]">
                Cosmic Simya
              </span>
            )}
          </span>
        </Link>

        <nav
          className={cn('hidden items-center gap-0.5 md:flex', chatMode && 'gap-1')}
          aria-label="Ana menü"
        >
          {desktopItems.map((item) => {
            const active = isActive(item.to);
            const accent = Boolean(item.accent);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'atlas-focus rounded-full px-3.5 py-2 text-[13px] transition duration-200',
                  active
                    ? accent
                      ? 'bg-white/[0.07] text-[#f0f2f5]'
                      : 'bg-white/[0.06] text-[#e8ecf2]'
                    : accent
                      ? 'text-[#c7cbd2] hover:bg-white/[0.05] hover:text-white'
                      : 'text-[#8b93a3] hover:bg-white/[0.04] hover:text-[#d4dae2]',
                )}
              >
                {accent ? (
                  <span className="inline-flex items-center gap-1.5">
                    {item.label}
                    <span className="text-[10px] opacity-70" aria-hidden>
                      ✦
                    </span>
                  </span>
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <AuthSessionControl />
          <button
            type="button"
            className="atlas-focus inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/16 text-[#d4dae2] md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-white/[0.08] bg-[#030304]/97 px-4 py-4 md:hidden"
          aria-label="Mobil menü"
        >
          <ul className="space-y-1">
            {mobileItems.map((item) => {
              const active = isActive(item.to);
              const accent = Boolean(item.accent);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'atlas-focus flex min-h-12 items-center rounded-xl px-4 text-base transition duration-200',
                      active
                        ? 'bg-white/[0.06] text-[#e8ecf2]'
                        : accent
                          ? 'text-[#c7cbd2] hover:bg-white/[0.04]'
                          : 'text-[#e8ecf2]/80 hover:bg-white/[0.04]',
                    )}
                  >
                    {accent ? (
                      <span className="inline-flex items-center gap-2">
                        {item.label}
                        <span className="text-[11px] opacity-70" aria-hidden>
                          ✦
                        </span>
                      </span>
                    ) : (
                      item.label
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
