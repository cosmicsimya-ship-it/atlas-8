import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useUIStore } from '../../store';
import { cn } from '../../utils/cn';
import { mockAgents } from '../../data/mockData';
import { systemMetrics } from '../../data/mockData';

const commands = [
  { label: 'Dashboard', path: '/', section: 'Navigation' },
  { label: 'Production Pipeline', path: '/produce', section: 'Navigation' },
  { label: 'Agent Center', path: '/agents', section: 'Navigation' },
  { label: 'Workflow Builder', path: '/workflows', section: 'Navigation' },
  { label: 'Queue Manager', path: '/queue', section: 'Navigation' },
  { label: 'Channel Manager', path: '/channels', section: 'Navigation' },
  { label: 'Arsenal', path: '/arsenal', section: 'Navigation' },
  { label: 'Asset Library', path: '/assets', section: 'Navigation' },
  { label: 'Analytics', path: '/analytics', section: 'Navigation' },
  { label: 'Memory', path: '/memory', section: 'Navigation' },
  { label: 'Settings', path: '/settings', section: 'Navigation' },
  ...mockAgents.map((a) => ({ label: a.name, path: `/agents/${a.id}`, section: 'Agents' })),
];

export default function AppLayout() {
  const { commandOpen, setCommandOpen } = useUIStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandOpen(!commandOpen);
      setQuery('');
      setSelected(0);
    }
    if (e.key === 'Escape') {
      setCommandOpen(false);
    }
  }, [commandOpen, setCommandOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const runCommand = (path: string) => {
    navigate(path);
    setCommandOpen(false);
    setQuery('');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-atlas-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          <Outlet />
        </main>
        {/* Status Bar */}
        <footer className="h-7 flex items-center justify-between px-4 border-t border-atlas-border bg-atlas-surface/60 text-[10px] font-mono text-atlas-text-dim shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              All Systems Operational
            </span>
            <span>{systemMetrics.agentsOnline}/{systemMetrics.agentsTotal} agents</span>
            <span>{systemMetrics.activePipelines} pipelines</span>
          </div>
          <div className="flex items-center gap-4">
            <span>API: {systemMetrics.apiUsagePercent}%</span>
            <span>ATLAS OS v2.0</span>
          </div>
        </footer>
      </div>

      {/* Command Palette */}
      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setCommandOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-atlas-surface border border-atlas-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-12 border-b border-atlas-border">
              <Search className="w-4 h-4 text-atlas-text-dim" />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
                  if (e.key === 'Enter' && filtered[selected]) { runCommand(filtered[selected].path); }
                }}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm text-atlas-text placeholder-atlas-text-dim/50 outline-none"
              />
              <kbd className="text-[10px] font-mono text-atlas-text-dim bg-atlas-surface2 px-1.5 py-0.5 rounded border border-atlas-border">ESC</kbd>
            </div>
            <div className="max-h-72 overflow-y-auto py-2">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-atlas-text-dim">No results found</div>
              )}
              {(() => {
                let lastSection = '';
                return filtered.map((cmd, i) => {
                  const showSection = cmd.section !== lastSection;
                  lastSection = cmd.section;
                  return (
                    <div key={cmd.path}>
                      {showSection && (
                        <div className="px-4 pt-2 pb-1 text-[9px] font-mono font-semibold text-atlas-text-dim/50 uppercase tracking-widest">
                          {cmd.section}
                        </div>
                      )}
                      <button
                        onClick={() => runCommand(cmd.path)}
                        onMouseEnter={() => setSelected(i)}
                        className={cn(
                          'w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors',
                          i === selected ? 'bg-atlas-accent/12 text-atlas-accent' : 'text-atlas-text-dim hover:text-atlas-text'
                        )}
                      >
                        {cmd.label}
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
