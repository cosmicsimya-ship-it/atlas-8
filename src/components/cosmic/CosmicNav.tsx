import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import AtlasCompassMark from '../brand/AtlasCompassMark';
import { cn } from '../../utils/cn';
import AuthSessionControl from './AuthSessionControl';

const NAV_ITEMS = [
  { to: '/atlas', label: 'ATLAS' },
  { to: '/analysis', label: 'İZDÜŞÜM' },
  { to: '/lara-prime', label: 'LARA PRIME' },
  { to: '/about', label: 'VAROLUŞ' },
] as const;

interface CosmicNavProps { transparent?: boolean; chatMode?: boolean; }

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
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const solid = scrolled || !transparent || open;

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition duration-300', solid ? 'border-b border-white/[0.08] bg-[#040405]/92 backdrop-blur-xl' : 'bg-[#040405]/42')}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="atlas-focus flex shrink-0 items-center gap-2.5 rounded-sm" aria-label="ATLAS ana sayfa">
          <AtlasCompassMark compact className="h-8 w-8" />
          <span className="flex flex-col">
            <span className="font-display text-[15px] tracking-[0.34em] text-[#f0f0ef]">ATLAS</span>
            {!chatMode && <span className="mt-0.5 text-[8px] uppercase tracking-[0.32em] text-[#8f9298]">Cosmic Simya</span>}
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Ana menü">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to || (item.to === '/analysis' && location.pathname.startsWith('/analysis/'));
            return (
              <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={cn('atlas-focus rounded-sm px-3 py-2 text-[11px] tracking-[0.14em] transition', active ? 'text-[#f3f3f1]' : 'text-[#9a9ca1] hover:text-[#e5e5e3]')}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <AuthSessionControl />
          <button type="button" className="atlas-focus inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/14 text-[#d4d5d7] md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-white/[0.08] bg-[#040405]/98 px-4 py-4 md:hidden" aria-label="Mobil menü">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => <li key={item.to}><Link to={item.to} className="atlas-focus flex min-h-12 items-center rounded-sm px-4 text-sm tracking-[0.12em] text-[#dededd] hover:bg-white/[0.035]">{item.label}</Link></li>)}
          </ul>
        </nav>
      )}
    </header>
  );
}
