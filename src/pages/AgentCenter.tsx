import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { mockAgents } from '../data/mockData';
import { getAgentIcon, getAgentColor, statusConfig, phaseConfig } from '../utils/agentHelpers';
import { StatusDot, Badge, ProgressBar } from '../components/ui';
import { cn } from '../utils/cn';
import type { AgentStatus, PipelinePhase } from '../types';

export default function AgentCenter() {
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');
  const [phaseFilter, setPhaseFilter] = useState<PipelinePhase | 'all'>('all');

  const filtered = mockAgents.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (phaseFilter !== 'all' && a.phase !== phaseFilter) return false;
    return true;
  });

  const statuses: (AgentStatus | 'all')[] = ['all', 'online', 'processing', 'idle', 'paused', 'error', 'offline'];
  const phases: (PipelinePhase | 'all')[] = ['all', 'research', 'content', 'production', 'optimization', 'publishing', 'analytics'];

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-atlas-text-bright">Agent Center</h2>
          <p className="text-xs text-atlas-text-dim mt-0.5">{mockAgents.length} agents · {mockAgents.filter((a) => a.status === 'processing').length} processing</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-atlas-text-dim" />
          <span className="text-[10px] font-mono text-atlas-text-dim uppercase">Status:</span>
          <div className="flex gap-1">
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-2 py-1 rounded text-[10px] font-mono transition-colors',
                  statusFilter === s ? 'bg-atlas-accent/15 text-atlas-accent' : 'text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2'
                )}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-atlas-text-dim uppercase">Phase:</span>
          <div className="flex gap-1 flex-wrap">
            {phases.map((p) => (
              <button key={p} onClick={() => setPhaseFilter(p)}
                className={cn('px-2 py-1 rounded text-[10px] font-mono transition-colors',
                  phaseFilter === p ? 'bg-atlas-accent/15 text-atlas-accent' : 'text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2'
                )}
              >
                {p === 'all' ? 'All' : phaseConfig[p].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((agent) => {
          const Icon = getAgentIcon(agent.id);
          const color = getAgentColor(agent.id);
          const sc = statusConfig[agent.status];
          const pc = phaseConfig[agent.phase];
          return (
            <Link key={agent.id} to={`/agents/${agent.id}`}
              className="bg-atlas-surface border border-atlas-border rounded-lg p-4 hover:border-atlas-accent/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}25` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-atlas-text-bright group-hover:text-atlas-accent transition-colors">{agent.name}</div>
                    <div className="text-[10px] text-atlas-text-dim">{agent.role}</div>
                  </div>
                </div>
                <StatusDot status={agent.status} size="sm" />
              </div>

              {/* Status + Phase */}
              <div className="flex items-center gap-2 mb-3">
                <Badge color={sc.color}>{sc.label}</Badge>
                <Badge color={pc.color}>{pc.label}</Badge>
              </div>

              {/* Current task */}
              {agent.currentTask && (
                <div className="text-[11px] text-atlas-text-dim mb-3 bg-atlas-surface2/50 rounded px-2 py-1.5 truncate">
                  {agent.currentTask}
                </div>
              )}

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <div className="text-[9px] text-atlas-text-dim font-mono uppercase">Done</div>
                  <div className="text-sm font-mono font-bold text-atlas-text-bright">{agent.completedToday}</div>
                </div>
                <div>
                  <div className="text-[9px] text-atlas-text-dim font-mono uppercase">Cost</div>
                  <div className="text-sm font-mono font-bold text-atlas-text-bright">${agent.costToday}</div>
                </div>
                <div>
                  <div className="text-[9px] text-atlas-text-dim font-mono uppercase">Queue</div>
                  <div className="text-sm font-mono font-bold text-atlas-text-bright">{agent.queueDepth}</div>
                </div>
              </div>

              {/* Success rate */}
              <div className="flex items-center gap-2">
                <ProgressBar value={agent.successRate} color={agent.successRate > 95 ? '#22c55e' : agent.successRate > 85 ? '#f59e0b' : '#ef4444'} />
                <span className="text-[10px] font-mono text-atlas-text-dim">{agent.successRate}%</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
