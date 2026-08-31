import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import AuthSessionControl from '../cosmic/AuthSessionControl';
import { landingNav } from '../../data/landing-content';
import { cn } from '../../utils/cn';
import { scrollToSection } from '../../utils/scroll-section';

const navLinkClass =
  'site-focus landing-nav-link rounded-full px-3.5 py-2 text-[13px] transition';

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
          ? 'border-b border-white/[0.08] bg-[#050608]/90 backdrop-blur-xl'
          : 'border-b border-white/[0.04] bg-[#050608]/55 backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="site-focus group flex shrink-0 items-center gap-2.5 rounded-sm"
          aria-label="ATLAS ana sayfa"
        >
          <img
            src="/atlas-north-star.png"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 shrink-0 rounded-full object-cover opacity-95 transition-opacity group-hover:opacity-100"
          />
          <span className="block">
            <span className="atlas-mark atlas-mark-sm atlas-mark-nav block leading-none">ATLAS</span>
            <span className="mt-1 block text-[9px] uppercase tracking-[0.28em] text-[#9aa3ae]">
              Cosmic Simya
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
          {landingNav.map((item) =>
            'to' in item && item.to ? (
              <Link key={item.label} to={item.to} className={navLinkClass}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                onClick={() => 'sectionId' in item && item.sectionId && scrollToSection(item.sectionId)}
                className={navLinkClass}
              >
                {item.label}
              </button>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <AuthSessionControl appearance="landing" autoOpen={autoOpenLogin} />
          </div>
          <button
            type="button"
            className="site-focus inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/16 text-[#d4dae2] md:hidden"
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
          className="border-t border-white/[0.08] bg-[#050608]/96 px-4 py-4 md:hidden"
          aria-label="Mobil menü"
        >
          <ul className="space-y-1">
            {landingNav.map((item) => (
              <li key={item.label}>
                {'to' in item && item.to ? (
                  <Link
                    to={item.to}
                    className="site-focus flex min-h-12 items-center rounded-xl px-4 text-base text-[#e8ecf2] hover:bg-white/[0.04]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if ('sectionId' in item && item.sectionId) scrollToSection(item.sectionId);
                      setOpen(false);
                    }}
                    className="site-focus flex min-h-12 w-full items-center rounded-xl px-4 text-left text-base text-[#e8ecf2] hover:bg-white/[0.04]"
                  >
                    {item.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-white/[0.08] pt-3">
            <AuthSessionControl appearance="landing" />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
