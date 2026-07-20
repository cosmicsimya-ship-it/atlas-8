import { useState } from 'react';
import { Brain, Lightbulb, AlertTriangle, TrendingUp, CheckCircle2, Search } from 'lucide-react';
import { mockMemory } from '../data/mockData';
import { Badge, ProgressBar } from '../components/ui';
import { cn } from '../utils/cn';

const typeConfig = {
  learning: { label: 'Learning', color: '#3b82f6', icon: Lightbulb },
  mistake: { label: 'Mistake', color: '#ef4444', icon: AlertTriangle },
  pattern: { label: 'Pattern', color: '#a855f7', icon: TrendingUp },
  success: { label: 'Success', color: '#22c55e', icon: CheckCircle2 },
};

type MemType = 'all' | 'learning' | 'mistake' | 'pattern' | 'success';

export default function MemoryPage() {
  const [typeFilter, setTypeFilter] = useState<MemType>('all');
  const [search, setSearch] = useState('');

  const filtered = mockMemory.filter((m) => {
    if (typeFilter !== 'all' && m.type !== typeFilter) return false;
    if (search && !m.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: mockMemory.length,
    learnings: mockMemory.filter((m) => m.type === 'learning').length,
    patterns: mockMemory.filter((m) => m.type === 'pattern').length,
    mistakes: mockMemory.filter((m) => m.type === 'mistake').length,
    successes: mockMemory.filter((m) => m.type === 'success').length,
    avgConfidence: (mockMemory.reduce((s, m) => s + m.confidence, 0) / mockMemory.length * 100).toFixed(0),
  };

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-atlas-accent" />
          <div>
            <h2 className="text-lg font-semibold text-atlas-text-bright">Memory</h2>
            <p className="text-xs text-atlas-text-dim mt-0.5">Persistent knowledge base · {stats.total} entries · {stats.avgConfidence}% avg confidence</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '#94a3b8' },
          { label: 'Learnings', value: stats.learnings, color: '#3b82f6' },
          { label: 'Patterns', value: stats.patterns, color: '#a855f7' },
          { label: 'Mistakes', value: stats.mistakes, color: '#ef4444' },
          { label: 'Successes', value: stats.successes, color: '#22c55e' },
        ].map((stat) => (
          <div key={stat.label} className="bg-atlas-surface border border-atlas-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[10px] font-mono text-atlas-text-dim uppercase">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-atlas-text-dim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memory..."
            className="w-full pl-9 pr-3 py-2 rounded-md bg-atlas-surface border border-atlas-border text-sm text-atlas-text placeholder-atlas-text-dim/50 outline-none focus:border-atlas-accent/40 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'learning', 'mistake', 'pattern', 'success'] as MemType[]).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                typeFilter === t ? 'bg-atlas-accent/15 text-atlas-accent' : 'text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2'
              )}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Entries */}
      <div className="space-y-3">
        {filtered.map((entry) => {
          const tc = typeConfig[entry.type];
          const MemIcon = tc.icon;
          return (
            <div key={entry.id} className="bg-atlas-surface border border-atlas-border rounded-lg p-4 hover:border-atlas-accent/15 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${tc.color}15` }}>
                  <MemIcon className="w-4 h-4" style={{ color: tc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge color={tc.color}>{tc.label}</Badge>
                    <span className="text-[10px] font-mono text-atlas-text-dim">Source: {entry.source}</span>
                    <span className="text-[10px] font-mono text-atlas-text-dim ml-auto">{entry.accesses} accesses · {entry.created}</span>
                  </div>
                  <p className="text-sm text-atlas-text leading-relaxed">{entry.content}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                      <span className="text-[9px] font-mono text-atlas-text-dim">Confidence</span>
                      <ProgressBar value={entry.confidence * 100} color={tc.color} />
                      <span className="text-[10px] font-mono text-atlas-text-dim">{(entry.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex gap-1">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="text-[8px] font-mono bg-atlas-surface2 text-atlas-text-dim px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
