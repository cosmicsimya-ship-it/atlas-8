import { useState, useEffect } from "react";
import { cn } from "../utils/cn";

const navItems = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "agents", label: "Agents" },
  { id: "communication", label: "Communication" },
  { id: "workflow", label: "Workflow" },
  { id: "tech-stack", label: "Tech Stack" },
  { id: "error-handling", label: "Error Handling" },
  { id: "roadmap", label: "Roadmap" },
];

export default function Navigation() {
  const [active, setActive] = useState("overview");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      const sections = navItems.map((item) => {
        const el = document.getElementById(item.id);
        if (!el) return { id: item.id, top: Infinity };
        return { id: item.id, top: Math.abs(el.getBoundingClientRect().top - 100) };
      });
      const closest = sections.reduce((a, b) => (a.top < b.top ? a : b));
      setActive(closest.id);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-atlas-bg/90 backdrop-blur-xl border-b border-atlas-border shadow-lg shadow-black/20"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm">
              A
            </div>
            <span className="font-bold text-lg tracking-tight text-atlas-text-bright">
              ATLAS
            </span>
            <span className="hidden sm:inline text-xs text-atlas-text-dim font-mono bg-atlas-surface px-2 py-0.5 rounded">
              v2.0
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActive(item.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-all duration-200",
                  active === item.id
                    ? "text-atlas-accent bg-atlas-accent/10 font-medium"
                    : "text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface"
                )}
              >
                {item.label}
              </a>
            ))}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-atlas-text-dim hover:text-atlas-text"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-atlas-surface/95 backdrop-blur-xl border-b border-atlas-border">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => { setActive(item.id); setMobileOpen(false); }}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm transition-all",
                  active === item.id
                    ? "text-atlas-accent bg-atlas-accent/10 font-medium"
                    : "text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2"
                )}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
