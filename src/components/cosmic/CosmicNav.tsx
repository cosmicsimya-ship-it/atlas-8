import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '../../utils/cn';
import AuthSessionControl from './AuthSessionControl';

const NAV_ITEMS: Array<{ to: string; label: string; accent?: boolean }> = [
  { to: '/atlas', label: 'ATLAS' },
  { to: '/analysis', label: 'İZDÜŞÜM' },
  { to: '/lara-prime', label: 'LARA PRIME', accent: true },
  { to: '/about', label: 'VAROLUŞ' },
];

const EXACT_ACTIVE_PATHS = new Set<string>(['/atlas', '/analysis', '/lara-prime', '/about']);

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

  const isActive = (to: string) =>
    EXACT_ACTIVE_PATHS.has(to)
      ? location.pathname === to || (to === '/analysis' && location.pathname.startsWith('/analysis/'))
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500',
        quiet
          ? 'border-b border-transparent bg-transparent'
          : solid
            ? 'border-b border-[#789bb8]/[0.08] bg-[#010307]/92 backdrop-blur-xl'
            : 'bg-[#010307]/30',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="atlas-focus group flex shrink-0 items-center gap-2.5 rounded-sm"
          aria-label="ATLAS ana sayfa"
        >
          <span className="relative flex h-8 w-8 items-center justify-center" aria-hidden="true">
            <span className="absolute h-7 w-[2px] bg-[linear-gradient(to_bottom,transparent,rgba(237,247,254,0.9),transparent)]" />
            <span className="absolute h-[2px] w-7 bg-[linear-gradient(to_right,transparent,rgba(237,247,254,0.86),transparent)]" />
            <span className="absolute h-4 w-[1.5px] rotate-45 bg-[linear-gradient(to_bottom,transparent,rgba(164,199,226,0.58),transparent)]" />
            <span className="absolute h-4 w-[1.5px] -rotate-45 bg-[linear-gradient(to_bottom,transparent,rgba(164,199,226,0.58),transparent)]" />
            <span className="h-2 w-2 rotate-45 border border-[#e2f0fa]/60 bg-[#b9d6e9]/15 shadow-[0_0_14px_rgba(125,169,204,0.22)]" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="atlas-mark atlas-mark-sm atlas-mark-nav block leading-none text-transparent">
              ATLAS
            </span>
            {!chatMode && (
              <span className="mt-1 block text-[9px] uppercase tracking-[0.28em] text-[#8195a6]">
                Cosmic Simya
              </span>
            )}
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Ana menü">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'atlas-focus rounded-sm px-3.5 py-2 text-[13px] tracking-[0.02em] transition duration-200',
                  active
                    ? item.accent
                      ? 'text-[#eef4f8]'
                      : 'text-[#e4edf4]'
                    : item.accent
                      ? 'text-[#b7c6d2] hover:text-[#eff6fb]'
                      : 'text-[#8fa2b2] hover:text-[#d7e5ef]',
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {item.accent ? <span className="text-[9px] text-[#bca96d]/75">✦</span> : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <AuthSessionControl />
          <button
            type="button"
            className="atlas-focus inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#7799b5]/18 text-[#c8d6e0] md:hidden"
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
          className="border-t border-[#789bb8]/[0.08] bg-[#010307]/98 px-4 py-4 md:hidden"
          aria-label="Mobil menü"
        >
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'atlas-focus flex min-h-12 items-center rounded-sm px-4 text-base transition duration-200',
                      active ? 'bg-[#6f94b2]/[0.06] text-[#e4edf4]' : 'text-[#b8c8d4] hover:bg-[#6f94b2]/[0.04]',
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {item.label}
                      {item.accent ? <span className="text-[10px] text-[#bca96d]/75">✦</span> : null}
                    </span>
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
