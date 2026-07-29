import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '../../utils/cn';
import AuthSessionControl from './AuthSessionControl';

const NAV_ITEMS = [
  { to: '/', label: 'Ana Kapı' },
  { to: '/analysis', label: 'Haritamı Oku' },
  { to: '/archive', label: 'Arşiv' },
  { to: '/atlas', label: 'Atlas' },
  { to: '/about', label: 'Hakkında' },
];

interface CosmicNavProps {
  transparent?: boolean;
}

export default function CosmicNav({ transparent = false }: CosmicNavProps) {
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

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        solid ? 'border-b border-white/8 bg-[#050505]/92 backdrop-blur-xl' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <Link
          to="/"
          className="group flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c9b37a]/70"
        >
          <span className="font-display text-sm tracking-[0.18em] text-[#f5f0e8]/88">
            Cosmicsimya.com!
          </span>
          <span className="text-[10px] uppercase tracking-[0.28em] text-[#c9b37a]/55">
            Atlas Intelligence
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'rounded-full px-4 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9b37a]/70',
                  active
                    ? 'bg-white/8 text-[#f5f0e8]'
                    : 'text-[#f5f0e8]/62 hover:bg-white/5 hover:text-[#f5f0e8]',
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-[#f5f0e8]/80 md:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9b37a]/70"
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
          className="border-t border-white/8 bg-[#050505]/96 px-4 py-4 md:hidden"
          aria-label="Mobil menü"
        >
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex min-h-12 items-center rounded-xl px-4 text-base text-[#f5f0e8]/85 hover:bg-white/5"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-white/8 pt-3">
            <AuthSessionControl />
          </div>
        </nav>
      )}
    </header>
  );
}
