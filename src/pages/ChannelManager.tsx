import { ExternalLink, TrendingUp, Eye, DollarSign, Plus } from 'lucide-react';
import { mockChannels, mockPipelines } from '../data/mockData';
import { StatusDot, Badge, MiniBar } from '../components/ui';

const viewsData = [12, 18, 15, 22, 30, 25, 28];

export default function ChannelManager() {
  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-atlas-text-bright">Channel Manager</h2>
          <p className="text-xs text-atlas-text-dim mt-0.5">{mockChannels.length} channels · {mockChannels.filter((c) => c.status === 'active').length} active</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-atlas-accent/15 text-atlas-accent text-xs font-medium hover:bg-atlas-accent/25 transition-colors">
          <Plus className="w-3 h-3" /> Add Channel
        </button>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {mockChannels.map((ch) => {
          const activePipelines = mockPipelines.filter((p) => p.channelId === ch.id && (p.status === 'processing' || p.status === 'review')).length;
          return (
            <div key={ch.id} className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden hover:border-atlas-accent/20 transition-all">
              {/* Header */}
              <div className="p-4 border-b border-atlas-border/50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {ch.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-atlas-text-bright">{ch.name}</div>
                      <div className="text-[10px] text-atlas-text-dim font-mono">{ch.handle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={ch.status === 'active' ? '#22c55e' : ch.status === 'setup' ? '#f59e0b' : '#94a3b8'}>
                      <StatusDot status={ch.status} size="xs" /> {ch.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-[10px] text-atlas-text-dim">{ch.niche} · {activePipelines} active pipelines</div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 divide-x divide-atlas-border/50">
                {[
                  { label: 'Subscribers', value: ch.subscribers, icon: TrendingUp },
                  { label: 'Avg Views', value: ch.avgViews, icon: Eye },
                  { label: 'Revenue/mo', value: ch.monthlyRevenue, icon: DollarSign },
                ].map((m) => (
                  <div key={m.label} className="p-3 text-center">
                    <div className="text-[9px] text-atlas-text-dim font-mono uppercase mb-0.5">{m.label}</div>
                    <div className="text-sm font-bold font-mono text-atlas-text-bright">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Performance */}
              <div className="p-4 border-t border-atlas-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div><span className="text-[9px] font-mono text-atlas-text-dim uppercase">CTR</span><div className="text-sm font-mono font-bold text-atlas-text-bright">{ch.ctr}%</div></div>
                    <div><span className="text-[9px] font-mono text-atlas-text-dim uppercase">Retention</span><div className="text-sm font-mono font-bold text-atlas-text-bright">{ch.retention}%</div></div>
                    <div><span className="text-[9px] font-mono text-atlas-text-dim uppercase">Growth</span><div className="text-sm font-mono font-bold text-emerald-400">+{ch.growthRate}%</div></div>
                  </div>
                </div>
                <MiniBar data={viewsData} color="#3b82f6" height={40} />
                <div className="flex items-center justify-between text-[9px] font-mono text-atlas-text-dim">
                  <span>7-day views trend</span>
                  <button className="flex items-center gap-1 text-atlas-accent hover:underline">
                    Details <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
