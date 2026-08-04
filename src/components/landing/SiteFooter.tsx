import { Link } from 'react-router-dom';

import { landingFooter } from '../../data/landing-content';

export default function SiteFooter() {
  const { brand, tagline, links } = landingFooter;

  return (
    <footer className="relative border-t border-white/[0.06] py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="atlas-mark atlas-mark-sm block">{brand}</span>
            <p className="mt-2 text-xs text-[#8b93a3]">{tagline}</p>
          </div>

          <nav aria-label="Alt bilgi">
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

        <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4 text-[11px] text-[#6f7886] sm:flex-row sm:items-center sm:justify-between">
          <p>Cosmicsimya için katmanlı okuma yüzeyi.</p>
          <p>© {new Date().getFullYear()} ATLAS</p>
        </div>
      </div>
    </footer>
  );
}
