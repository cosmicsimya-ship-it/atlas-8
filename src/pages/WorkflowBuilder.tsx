import { useState } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { mockAgents } from '../data/mockData';
import { getAgentIcon, getAgentColor, statusConfig, phaseConfig } from '../utils/agentHelpers';
import { StatusDot, Badge, SectionLabel } from '../components/ui';
import { cn } from '../utils/cn';
import type { PipelinePhase } from '../types';

const pipelinePhases: { phase: PipelinePhase; agents: string[] }[] = [
  { phase: 'research', agents: ['trend-researcher', 'topic-discoverer', 'competitor-analyzer'] },
  { phase: 'content', agents: ['script-writer', 'story-architect'] },
  { phase: 'production', agents: ['prompt-engineer', 'image-director', 'video-director', 'voice-director'] },
  { phase: 'optimization', agents: ['thumbnail-agent', 'seo-agent'] },
  { phase: 'publishing', agents: ['publisher'] },
  { phase: 'analytics', agents: ['analytics-agent', 'learning-agent'] },
];

export default function WorkflowBuilder() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const selectedAgent = selectedNode ? mockAgents.find((a) => a.id === selectedNode) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-atlas-text-bright">Workflow Builder</h2>
          <p className="text-xs text-atlas-text-dim mt-0.5">Visual pipeline editor · 6 phases · 14 agents</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-colors">
            <Play className="w-3 h-3" /> Run Pipeline
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-atlas-surface2 text-atlas-text-dim text-xs hover:text-atlas-text transition-colors">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* Pipeline Canvas */}
      <div className="bg-atlas-surface border border-atlas-border rounded-lg p-6 overflow-x-auto">
        <div className="flex items-start gap-3 min-w-[900px]">
          {pipelinePhases.map((phaseDef, pi) => {
            const pc = phaseConfig[phaseDef.phase];
            return (
              <div key={phaseDef.phase} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-2 min-w-[140px]">
                  {/* Phase header */}
                  <div className="text-center mb-1 w-full">
                    <Badge color={pc.color}>{pc.label}</Badge>
                    <div className="text-[9px] font-mono text-atlas-text-dim mt-1">Phase {pi + 1}</div>
                  </div>

                  {/* Agent nodes */}
                  <div className="space-y-2 w-full">
                    {phaseDef.agents.map((agentId) => {
                      const agent = mockAgents.find((a) => a.id === agentId);
                      if (!agent) return null;
                      const Icon = getAgentIcon(agent.id);
                      const color = getAgentColor(agent.id);
                      const isSelected = selectedNode === agent.id;
                      const sc = statusConfig[agent.status];
                      return (
                        <button
                          key={agent.id}
                          onClick={() => setSelectedNode(isSelected ? null : agent.id)}
                          className={cn(
                            'w-full rounded-lg p-3 text-left transition-all border',
                            isSelected
                              ? 'bg-atlas-accent/10 border-atlas-accent/40 shadow-lg shadow-atlas-accent/10'
                              : 'bg-atlas-surface2/60 border-atlas-border hover:border-atlas-accent/20'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                              <Icon className="w-3 h-3" style={{ color }} />
                            </div>
                            <StatusDot status={agent.status} size="xs" />
                          </div>
                          <div className="text-[11px] font-medium text-atlas-text-bright truncate">{agent.name}</div>
                          <div className="text-[9px] font-mono mt-0.5" style={{ color: sc.color }}>{sc.label}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Phase config indicators */}
                  <div className="flex items-center gap-1 mt-1">
                    {phaseDef.agents.length > 1 && <Badge color="#06b6d4">Parallel</Badge>}
                    <Badge color="#94a3b8"><CheckCircle2 className="w-2.5 h-2.5" /> Gate</Badge>
                  </div>
                </div>

                {/* Arrow between phases */}
                {pi < pipelinePhases.length - 1 && (
                  <div className="flex flex-col items-center gap-1 self-center mt-8">
                    <ArrowRight className="w-5 h-5 text-atlas-border" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback loop */}
        <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-atlas-border/50">
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-atlas-text-dim">
            <span className="text-amber-400 font-medium">Feedback Loop</span> — Learning Agent optimizes all upstream agents based on performance data
          </span>
        </div>
      </div>

      {/* Selected Node Detail Panel */}
      {selectedAgent && (
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = getAgentIcon(selectedAgent.id);
                const color = getAgentColor(selectedAgent.id);
                return (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                );
              })()}
              <div>
                <h3 className="text-sm font-bold text-atlas-text-bright">{selectedAgent.name}</h3>
                <p className="text-xs text-atlas-text-dim">{selectedAgent.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-1.5 rounded hover:bg-atlas-surface2 text-atlas-text-dim hover:text-atlas-text transition-colors">
                <Play className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded hover:bg-atlas-surface2 text-atlas-text-dim hover:text-atlas-text transition-colors">
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-atlas-surface2/50 rounded-lg p-3">
              <div className="text-[9px] font-mono text-atlas-text-dim uppercase mb-1">Status</div>
              <div className="flex items-center gap-1.5"><StatusDot status={selectedAgent.status} size="xs" /><span className="text-sm font-medium text-atlas-text-bright">{statusConfig[selectedAgent.status].label}</span></div>
            </div>
            <div className="bg-atlas-surface2/50 rounded-lg p-3">
              <div className="text-[9px] font-mono text-atlas-text-dim uppercase mb-1">Model</div>
              <div className="text-sm font-mono text-atlas-text-bright">{selectedAgent.model}</div>
            </div>
            <div className="bg-atlas-surface2/50 rounded-lg p-3">
              <div className="text-[9px] font-mono text-atlas-text-dim uppercase mb-1">Queue</div>
              <div className="text-sm font-mono text-atlas-text-bright">{selectedAgent.queueDepth} tasks</div>
            </div>
            <div className="bg-atlas-surface2/50 rounded-lg p-3">
              <div className="text-[9px] font-mono text-atlas-text-dim uppercase mb-1">Cost/Day</div>
              <div className="text-sm font-mono text-atlas-text-bright">${selectedAgent.costToday}</div>
            </div>
          </div>

          {/* Workflow rules */}
          <div className="mt-4 space-y-2">
            <SectionLabel>Workflow Rules</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { icon: RotateCcw, label: 'Retry on failure', value: '3 attempts' },
                { icon: Clock, label: 'Timeout', value: '120 seconds' },
                { icon: AlertCircle, label: 'On error', value: 'Fallback model' },
              ].map((rule) => (
                <div key={rule.label} className="flex items-center gap-2 bg-atlas-surface2/30 rounded-md p-2.5">
                  <rule.icon className="w-3.5 h-3.5 text-atlas-text-dim shrink-0" />
                  <div>
                    <div className="text-[10px] text-atlas-text-dim">{rule.label}</div>
                    <div className="text-xs font-mono text-atlas-text-bright">{rule.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
