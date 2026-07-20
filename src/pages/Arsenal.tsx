import { useState } from 'react';
import { Search, Plus, Bookmark, Zap } from 'lucide-react';
import { mockArsenal } from '../data/mockData';
import { Badge } from '../components/ui';
import { cn } from '../utils/cn';

const categories = ['All', 'Prompt Library', 'Workflow Templates', 'Thumbnail Templates', 'Story Templates', 'Visual Styles', 'Voice Styles', 'Model Presets', 'Publishing Rules', 'Automation Blocks', 'API Connectors', 'Channel Assets', 'Reusable Components'];
const typeColors: Record<string, string> = {
  prompt: '#3b82f6', workflow: '#a855f7', thumbnail: '#f97316', story: '#ec4899',
  visual_style: '#06b6d4', voice_style: '#14b8a6', model_preset: '#8b5cf6',
  publishing_rule: '#22c55e', automation: '#f59e0b', connector: '#ef4444',
  asset: '#eab308', component: '#10b981',
};

export default function Arsenal() {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('All');

  const filtered = mockArsenal.filter((item) => {
    if (activeCat !== 'All' && item.category !== activeCat) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-atlas-text-bright">Arsenal</h2>
          <p className="text-xs text-atlas-text-dim mt-0.5">{mockArsenal.length} reusable assets · Shared across all agents</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-atlas-accent/15 text-atlas-accent text-xs font-medium hover:bg-atlas-accent/25 transition-colors">
          <Plus className="w-3 h-3" /> Add Asset
        </button>
      </div>

      {/* Search + Categories */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-atlas-text-dim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search arsenal..."
            className="w-full pl-9 pr-3 py-2 rounded-md bg-atlas-surface border border-atlas-border text-sm text-atlas-text placeholder-atlas-text-dim/50 outline-none focus:border-atlas-accent/40 transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCat(cat)}
            className={cn('px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
              activeCat === cat ? 'bg-atlas-accent/15 text-atlas-accent' : 'text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Arsenal Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((item) => (
          <div key={item.id} className="bg-atlas-surface border border-atlas-border rounded-lg p-4 hover:border-atlas-accent/20 transition-all group cursor-pointer">
            <div className="flex items-start justify-between mb-2">
              <Badge color={typeColors[item.type] || '#94a3b8'}>{item.type.replace('_', ' ')}</Badge>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-atlas-surface2 text-atlas-text-dim">
                <Bookmark className="w-3 h-3" />
              </button>
            </div>
            <h3 className="text-sm font-semibold text-atlas-text-bright mb-1">{item.name}</h3>
            <p className="text-[11px] text-atlas-text-dim mb-3 line-clamp-2">{item.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] font-mono text-atlas-text-dim">
                <Zap className="w-2.5 h-2.5" /> {item.uses} uses
              </div>
              <span className="text-[10px] font-mono text-atlas-text-dim">{item.lastUsed}</span>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {item.tags.map((tag) => (
                <span key={tag} className="text-[8px] font-mono bg-atlas-surface2 text-atlas-text-dim px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
