import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '../../utils/cn';
import AuthSessionControl from './AuthSessionControl';

const NAV_ITEMS = [
  { to: '/', label: 'Ana Sayfa' },
  { to: '/analysis/symbolic', label: 'Sembolik Analiz' },
  { to: '/analysis', label: 'Analiz' },
  { to: '/archive', label: 'Arşiv' },
  { to: '/atlas', label: 'Atlas' },
  { to: '/about', label: 'Hakkında' },
];

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

  const visibleItems = chatMode
    ? NAV_ITEMS.filter((item) =>
        ['/', '/atlas', '/analysis/symbolic', '/archive'].includes(item.to),
      )
    : NAV_ITEMS;

  const isActive = (to: string) =>
    to === '/' || to === '/analysis'
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500',
        quiet
          ? 'border-b border-transparent bg-transparent'
          : solid
            ? 'border-b border-white/[0.06] bg-[#050608]/88 backdrop-blur-xl'
            : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="atlas-focus group flex shrink-0 flex-col gap-0.5 rounded-sm"
          aria-label="ATLAS ana sayfa"
        >
          <span className="atlas-mark atlas-mark-sm atlas-mark-nav block leading-none text-transparent">
            ATLAS
          </span>
          {!chatMode && (
            <span className="mt-1 block text-[9px] uppercase tracking-[0.28em] text-[#9aa3ae]">
              Cosmicsimya
            </span>
          )}
        </Link>

        <nav
          className={cn('hidden items-center gap-0.5 md:flex', chatMode && 'gap-1')}
          aria-label="Ana menü"
        >
          {visibleItems
            .filter((item) => !chatMode || item.to !== '/')
            .map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'atlas-focus rounded-full px-3.5 py-2 text-[13px] transition duration-200',
                    active
                      ? 'bg-white/[0.06] text-[#e8ecf2]'
                      : 'text-[#8b93a3] hover:bg-white/[0.04] hover:text-[#d4dae2]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <AuthSessionControl />
          </div>
          <button
            type="button"
            className="atlas-focus inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/16 text-[#d4dae2] md:hidden"
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
          className="border-t border-white/[0.08] bg-[#050608]/96 px-4 py-4 md:hidden"
          aria-label="Mobil menü"
        >
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const active = isActive(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'atlas-focus flex min-h-12 items-center rounded-xl px-4 text-base transition duration-200',
                      active
                        ? 'bg-white/[0.06] text-[#e8ecf2]'
                        : 'text-[#e8ecf2]/80 hover:bg-white/[0.04]',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-white/[0.08] pt-3">
            <AuthSessionControl />
          </div>
        </nav>
      )}
    </header>
  );
}
