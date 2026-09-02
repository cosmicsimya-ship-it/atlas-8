import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import AuthSessionControl from '../cosmic/AuthSessionControl';
import { cn } from '../../utils/cn';

const navLinkClass =
  'site-focus landing-nav-link rounded-sm px-3.5 py-2 text-[13px] tracking-[0.02em] transition';

const primaryNav = [
  { label: 'ATLAS', to: '/atlas' },
  { label: 'İZDÜŞÜM', to: '/analysis' },
  { label: 'LARA PRIME', to: '/lara-prime' },
  { label: 'VAROLUŞ', to: '/about' },
] as const;

export default function AtlasNav({ autoOpenLogin = false }: { autoOpenLogin?: boolean }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
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

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-300',
        scrolled || open
          ? 'border-b border-[#7aa6cc]/[0.08] bg-[#02050a]/88 backdrop-blur-xl'
          : 'bg-[#02050a]/50',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="site-focus group flex shrink-0 items-center gap-2.5 rounded-sm"
          aria-label="ATLAS ana sayfa"
        >
          <span className="relative flex h-8 w-8 items-center justify-center" aria-hidden="true">
            <span className="absolute h-7 w-px bg-[linear-gradient(to_bottom,transparent,rgba(219,237,250,0.8),transparent)]" />
            <span className="absolute h-px w-7 bg-[linear-gradient(to_right,transparent,rgba(219,237,250,0.72),transparent)]" />
            <span className="absolute h-3.5 w-px rotate-45 bg-[linear-gradient(to_bottom,transparent,rgba(142,184,219,0.5),transparent)]" />
            <span className="absolute h-3.5 w-px -rotate-45 bg-[linear-gradient(to_bottom,transparent,rgba(142,184,219,0.5),transparent)]" />
            <span className="h-1.5 w-1.5 rotate-45 border border-[#d8e9f7]/45 bg-[#86b2d5]/10 shadow-[0_0_12px_rgba(108,163,208,0.2)]" />
          </span>
          <span className="flex flex-col">
            <span className="atlas-mark atlas-mark-sm atlas-mark-nav block leading-none">ATLAS</span>
            <span lang="en" className="mt-1 block text-[0.625rem] tracking-[0.28em] text-[#8298aa]">
              Cosmic Simya
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Ana menü">
          {primaryNav.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                navLinkClass,
                location.pathname === item.to
                  ? 'text-[#e5f0f7]'
                  : 'text-[#9badbd] hover:text-[#dceaf4]',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <AuthSessionControl appearance="landing" autoOpen={autoOpenLogin} />
          <button
            type="button"
            className="site-focus inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#759fc2]/20 text-[#cbd9e4] md:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="landing-mobile-nav"
          className="border-t border-[#789fc0]/[0.08] bg-[#02050a]/98 px-4 py-4 md:hidden"
          aria-label="Mobil menü"
        >
          <ul className="space-y-1">
            {primaryNav.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="site-focus flex min-h-12 items-center rounded-sm px-4 text-base text-[#dce7ef] hover:bg-[#6f9abe]/[0.06]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
