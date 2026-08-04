import { useLocation } from 'react-router-dom';
import { Search, Bell, Command } from 'lucide-react';
import { useUIStore } from '../../store';
import { mockNotifications } from '../../data/mockData';
import { Kbd } from '../ui';

const pathTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/agents': 'Agent Center',
  '/workflows': 'Workflow Builder',
  '/produce': 'Production Pipeline',
  '/queue': 'Queue Manager',
  '/channels': 'Channel Manager',
  '/arsenal': 'Arsenal',
  '/assets': 'Asset Library',
  '/analytics': 'Analytics',
  '/memory': 'Memory',
  '/settings': 'Settings',
};

export default function TopBar() {
  const location = useLocation();
  const { setCommandOpen } = useUIStore();
  const unread = mockNotifications.filter((n) => !n.read).length;

  const pathParts = location.pathname.split('/').filter(Boolean);
  let title = pathTitles[location.pathname] || pathTitles['/' + pathParts[0]] || 'ATLAS';
  if (pathParts[0] === 'agents' && pathParts[1]) {
    title = 'Agent Detail';
  }

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-atlas-border bg-atlas-surface/80 backdrop-blur-sm shrink-0 z-20">
      {/* Left: Title + Breadcrumb */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-atlas-text-bright">{title}</h1>
        {pathParts.length > 1 && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-atlas-text-dim font-mono">
            <span>/</span>
            <span className="text-atlas-text">{pathParts[pathParts.length - 1]}</span>
          </div>
        )}
      </div>

      {/* Right: Search + Notifications */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-2 h-8 px-3 rounded-md bg-atlas-surface2/60 border border-atlas-border text-atlas-text-dim hover:text-atlas-text hover:border-atlas-border-glow/30 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs hidden sm:inline">Search</span>
          <div className="hidden sm:flex items-center gap-0.5 ml-2">
            <Kbd><Command className="w-2.5 h-2.5" /></Kbd>
            <Kbd>K</Kbd>
          </div>
        </button>

        <button className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-atlas-surface2/60 transition-colors text-atlas-text-dim hover:text-atlas-text">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
