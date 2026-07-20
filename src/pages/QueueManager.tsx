import { useState } from 'react';
import { RefreshCw, Play, Trash2, AlertCircle } from 'lucide-react';
import { mockQueue, mockPipelines } from '../data/mockData';
import { getAgentIcon, getAgentColor, priorityConfig } from '../utils/agentHelpers';
import { StatusDot, Badge, SectionLabel } from '../components/ui';
import { cn } from '../utils/cn';

type QueueTab = 'all' | 'processing' | 'waiting' | 'retry' | 'done' | 'failed';

const tabConfig: { key: QueueTab; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: '#94a3b8' },
  { key: 'processing', label: 'Processing', color: '#3b82f6' },
  { key: 'waiting', label: 'Waiting', color: '#f59e0b' },
  { key: 'retry', label: 'Retry', color: '#a855f7' },
  { key: 'done', label: 'Completed', color: '#22c55e' },
  { key: 'failed', label: 'Failed', color: '#ef4444' },
];

export default function QueueManager() {
  const [activeTab, setActiveTab] = useState<QueueTab>('all');

  const filtered = activeTab === 'all' ? mockQueue : mockQueue.filter((q) => q.status === activeTab);
  const counts = {
    all: mockQueue.length,
    processing: mockQueue.filter((q) => q.status === 'processing').length,
    waiting: mockQueue.filter((q) => q.status === 'waiting').length,
    retry: mockQueue.filter((q) => q.status === 'retry').length,
    done: mockQueue.filter((q) => q.status === 'done').length,
    failed: mockQueue.filter((q) => q.status === 'failed').length,
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-atlas-text-bright">Queue Manager</h2>
          <p className="text-xs text-atlas-text-dim mt-0.5">{mockQueue.length} items · {counts.processing} processing · {counts.failed} failed</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-atlas-surface2 text-atlas-text-dim text-xs hover:text-atlas-text transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {tabConfig.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('bg-atlas-surface border rounded-lg p-3 text-center transition-all',
              activeTab === tab.key ? 'border-atlas-accent/40' : 'border-atlas-border hover:border-atlas-border-glow/20'
            )}
          >
            <div className="text-xl font-bold font-mono" style={{ color: tab.color }}>{counts[tab.key]}</div>
            <div className="text-[10px] font-mono text-atlas-text-dim uppercase mt-0.5">{tab.label}</div>
          </button>
        ))}
      </div>

      {/* Pipeline Timeline */}
      <div className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-atlas-border">
          <SectionLabel>Pipeline Processing Timeline</SectionLabel>
        </div>
        <div className="p-4 space-y-2">
          {mockPipelines.filter((p) => p.status !== 'completed' && p.status !== 'failed').map((pl) => {
            const phases = ['research', 'content', 'production', 'optimization', 'publishing', 'analytics'];
            const currentIdx = phases.indexOf(pl.phase);
            return (
              <div key={pl.id} className="flex items-center gap-3">
                <div className="w-40 truncate text-xs font-medium text-atlas-text-bright shrink-0">{pl.title}</div>
                <div className="flex-1 flex items-center gap-1">
                  {phases.map((phase, i) => (
                    <div key={phase} className={cn('h-2 flex-1 rounded-full',
                      i < currentIdx ? 'bg-emerald-500' : i === currentIdx ? 'bg-blue-500 animate-pulse-subtle' : 'bg-atlas-surface2'
                    )} />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-atlas-text-dim w-10 text-right shrink-0">{pl.progress}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-mono text-atlas-text-dim uppercase border-b border-atlas-border">
              <th className="text-left px-4 py-2.5 font-medium">Task</th>
              <th className="text-left px-3 py-2.5 font-medium">Agent</th>
              <th className="text-left px-3 py-2.5 font-medium">Priority</th>
              <th className="text-left px-3 py-2.5 font-medium">Status</th>
              <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Attempts</th>
              <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Created</th>
              <th className="text-right px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const Icon = getAgentIcon(item.agentId);
              const color = getAgentColor(item.agentId);
              const pc = priorityConfig[item.priority];
              const statusColor = item.status === 'processing' ? '#3b82f6' : item.status === 'waiting' ? '#f59e0b' : item.status === 'retry' ? '#a855f7' : item.status === 'done' ? '#22c55e' : '#ef4444';
              return (
                <tr key={item.id} className="border-b border-atlas-border/50 hover:bg-atlas-surface2/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusDot status={item.status === 'processing' ? 'processing' : item.status === 'failed' ? 'error' : item.status === 'retry' ? 'paused' : 'idle'} size="xs" />
                      <span className="text-atlas-text-bright font-medium truncate max-w-[200px]">{item.title}</span>
                    </div>
                    {item.error && <div className="flex items-center gap-1 mt-1 text-[10px] text-red-400"><AlertCircle className="w-2.5 h-2.5" />{item.error}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3" style={{ color }} />
                      <span className="text-xs text-atlas-text-dim">{item.agent}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><Badge color={pc.color}>{pc.label}</Badge></td>
                  <td className="px-3 py-2.5"><Badge color={statusColor}>{item.status}</Badge></td>
                  <td className="px-3 py-2.5 font-mono text-atlas-text-dim text-xs hidden sm:table-cell">{item.attempts}/{item.maxAttempts}</td>
                  <td className="px-3 py-2.5 font-mono text-atlas-text-dim text-xs hidden md:table-cell">{item.createdAt}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(item.status === 'failed' || item.status === 'retry') && (
                        <button className="p-1 rounded hover:bg-atlas-surface2 text-atlas-text-dim hover:text-emerald-400 transition-colors" title="Retry">
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      )}
                      {item.status === 'waiting' && (
                        <button className="p-1 rounded hover:bg-atlas-surface2 text-atlas-text-dim hover:text-blue-400 transition-colors" title="Start">
                          <Play className="w-3 h-3" />
                        </button>
                      )}
                      <button className="p-1 rounded hover:bg-atlas-surface2 text-atlas-text-dim hover:text-red-400 transition-colors" title="Remove">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
