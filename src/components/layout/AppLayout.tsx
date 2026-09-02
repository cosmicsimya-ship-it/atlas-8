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
  { label: 'Dashboard', path: '/dashboard', section: 'Navigation' },
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

  const filtered = query ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())) : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault(); setCommandOpen(!commandOpen); setQuery(''); setSelected(0);
    }
    if (e.key === 'Escape') setCommandOpen(false);
  }, [commandOpen, setCommandOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const runCommand = (path: string) => { navigate(path); setCommandOpen(false); setQuery(''); };

  return (
    <div className="atlas-compass-shell flex h-screen w-screen overflow-hidden bg-[#040405]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6"><Outlet /></main>
        <footer className="h-7 shrink-0 flex items-center justify-between border-t border-white/[0.08] bg-black/30 px-4 text-[10px] font-mono text-[#8f9298]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#d9dadd]" />All Systems Operational</span>
            <span>{systemMetrics.agentsOnline}/{systemMetrics.agentsTotal} agents</span>
            <span>{systemMetrics.activePipelines} pipelines</span>
          </div>
          <div className="flex items-center gap-4"><span>API: {systemMetrics.apiUsagePercent}%</span><span>ATLAS OS v2.0</span></div>
        </footer>
      </div>

      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setCommandOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.12] bg-[#09090b] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-12 items-center gap-3 border-b border-white/[0.08] px-4">
              <Search className="h-4 w-4 text-[#92959b]" />
              <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setSelected(0); }} onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
                if (e.key === 'Enter' && filtered[selected]) runCommand(filtered[selected].path);
              }} placeholder="Komut veya sayfa ara…" className="flex-1 bg-transparent text-sm text-[#e5e5e3] placeholder-[#6f7278] outline-none" aria-label="Komut paleti araması" />
              <kbd className="rounded border border-white/[0.1] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-mono text-[#92959b]">ESC</kbd>
            </div>
            <div className="max-h-72 overflow-y-auto py-2">
              {filtered.length === 0 && <div className="px-4 py-8 text-center text-sm text-[#92959b]">Eşleşen komut yok</div>}
              {(() => {
                let lastSection = '';
                return filtered.map((cmd, i) => {
                  const showSection = cmd.section !== lastSection; lastSection = cmd.section;
                  return <div key={cmd.path}>{showSection && <div className="px-4 pb-1 pt-2 text-[9px] font-mono font-semibold uppercase tracking-widest text-[#70737a]">{cmd.section}</div>}<button onClick={() => runCommand(cmd.path)} onMouseEnter={() => setSelected(i)} className={cn('flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors', i === selected ? 'bg-white/[0.055] text-[#f0f0ef]' : 'text-[#9a9ca1] hover:text-[#e5e5e3]')}>{cmd.label}</button></div>;
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
