import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bot, GitBranch, ListOrdered, Monitor,
  Shield, FolderOpen, BarChart3, Brain, Settings,
  ChevronLeft, ChevronRight, Clapperboard,
} from 'lucide-react';
import { useUIStore } from '../../store';
import { cn } from '../../utils/cn';
import { StatusDot } from '../ui';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: string;
}

const sections: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { path: '/agents', label: 'Agent Center', icon: Bot, badge: '14' },
      { path: '/workflows', label: 'Workflows', icon: GitBranch },
      { path: '/queue', label: 'Queue', icon: ListOrdered, badge: '5' },
    ],
  },
  {
    title: 'PRODUCTION',
    items: [
      { path: '/produce', label: 'Pipeline', icon: Clapperboard, badge: 'NEW' },
      { path: '/channels', label: 'Channels', icon: Monitor },
      { path: '/arsenal', label: 'Arsenal', icon: Shield },
      { path: '/assets', label: 'Assets', icon: FolderOpen },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/memory', label: 'Memory', icon: Brain },
    ],
  },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path) && (path !== '/' || location.pathname === '/');

  return (
    <aside className={cn(
      'h-full flex flex-col bg-atlas-surface border-r border-atlas-border transition-all duration-200 shrink-0 z-30',
      sidebarCollapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo */}
      <div className="h-12 flex items-center gap-2.5 px-4 border-b border-atlas-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
          A
        </div>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-sm tracking-tight text-atlas-text-bright">ATLAS</span>
            <span className="text-[9px] font-mono text-atlas-text-dim bg-atlas-surface2 px-1.5 py-0.5 rounded">OS</span>
          </div>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && !sidebarCollapsed && (
              <div className="px-2 mb-1.5 text-[9px] font-mono font-semibold text-atlas-text-dim/60 uppercase tracking-widest">
                {section.title}
              </div>
            )}
            {section.title && sidebarCollapsed && <div className="border-t border-atlas-border mx-2 my-1" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.path, item.exact);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md transition-colors text-sm group',
                      sidebarCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5',
                      active
                        ? 'bg-atlas-accent/12 text-atlas-accent'
                        : 'text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2/60'
                    )}
                  >
                    <item.icon className={cn('w-4 h-4 shrink-0', active && 'text-atlas-accent')} />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] font-mono bg-atlas-surface2 text-atlas-text-dim px-1.5 py-0.5 rounded">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-atlas-border p-2 space-y-1 shrink-0">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-md transition-colors text-sm',
            sidebarCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5',
            location.pathname === '/settings'
              ? 'bg-atlas-accent/12 text-atlas-accent'
              : 'text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2/60'
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span className="flex-1">Settings</span>}
        </Link>

        {/* System status */}
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-atlas-surface2/40">
            <StatusDot status="online" size="xs" />
            <span className="text-[10px] font-mono text-emerald-400/80">Operational</span>
            <span className="text-[10px] font-mono text-atlas-text-dim ml-auto">99.7%</span>
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex items-center gap-2 rounded-md text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2/60 transition-colors',
            sidebarCollapsed ? 'justify-center p-2 w-full' : 'px-2.5 py-1.5 w-full'
          )}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
