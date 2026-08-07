import { Link } from 'react-router-dom';

import { landingFooter, socialLinks } from '../../data/landing-content';

export default function SiteFooter() {
  const { brand, tagline, links } = landingFooter;

  return (
    <footer className="relative border-t border-white/[0.06] py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <span className="atlas-mark atlas-mark-sm block">{brand}</span>
            <p className="mt-2 text-xs text-[#8b93a3]">{tagline}</p>
          </div>

          <nav aria-label="Alt bilgi" className="min-w-0">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="site-focus text-xs text-[#9aa3ae] transition hover:text-[#e8ecf2]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <nav aria-label="Sosyal medya" className="min-w-0">
            <ul className="flex flex-wrap items-center gap-2 sm:gap-3">
              <li>
                <a
                  href={socialLinks.instagram.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={socialLinks.instagram.ariaLabel}
                  title={socialLinks.instagram.label}
                  className="site-focus inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-[#c5ccd6] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-[#eef1f5]"
                >
                  <InstagramIcon />
                  <span>{socialLinks.instagram.label}</span>
                </a>
              </li>
              <li>
                <a
                  href={socialLinks.telegram.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={socialLinks.telegram.ariaLabel}
                  title={socialLinks.telegram.label}
                  className="site-focus inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-[#c5ccd6] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-[#eef1f5]"
                >
                  <TelegramIcon />
                  <span>{socialLinks.telegram.label}</span>
                </a>
              </li>
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-1 text-[11px] text-[#6f7886] sm:items-end sm:text-right">
            <p className="break-words">Örüntüyü okur. Denklem kurar.</p>
            <p>© {new Date().getFullYear()} ATLAS</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.5 4.5 3.8 11.2c-.7.27-.69.76-.12.95l4.3 1.34 1.66 5.2c.2.63.57.77 1.05.48l2.4-1.76 4.5 3.32c.52.29 1.08.14 1.24-.49l2.7-13.1c.2-1-.41-1.45-1.03-1.14Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m9.9 13.4 8.6-5.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
