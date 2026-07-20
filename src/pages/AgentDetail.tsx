import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Layers, Terminal, Database, Settings2, History } from 'lucide-react';
import { mockAgents } from '../data/mockData';
import { mockMemory } from '../data/mockData';
import { agents as agentSpecs } from '../data/agents';
import { getAgentIcon, getAgentColor, statusConfig, phaseConfig } from '../utils/agentHelpers';
import { StatusDot, Badge, MetricCard, SectionLabel } from '../components/ui';
import { cn } from '../utils/cn';

const tabs = ['Overview', 'Memory', 'History', 'Logs', 'Config'] as const;
type Tab = typeof tabs[number];

const mockLogs = [
  { ts: '14:32:08', level: 'INFO', msg: 'Agent initialized with model Claude 3.5 Sonnet' },
  { ts: '14:32:09', level: 'INFO', msg: 'Connected to Redis memory store (245MB allocated)' },
  { ts: '14:32:10', level: 'INFO', msg: 'Subscribed to topic-approved queue' },
  { ts: '14:33:15', level: 'INFO', msg: 'Received task: Write script for "AI Revolution 2026"' },
  { ts: '14:33:16', level: 'DEBUG', msg: 'Loading context: channel voice guide, SEO keywords, competitor data' },
  { ts: '14:34:02', level: 'INFO', msg: 'Hook generation complete — 4 variants produced' },
  { ts: '14:36:45', level: 'INFO', msg: 'Section 1/5 drafted (420 words, Flesch-Kincaid: 8.2)' },
  { ts: '14:39:18', level: 'WARN', msg: 'Retention prediction below threshold at section 3 — inserting pattern interrupt' },
  { ts: '14:41:30', level: 'INFO', msg: 'Section 3/5 revised with additional hook — predicted retention +8%' },
  { ts: '14:44:55', level: 'INFO', msg: 'Draft complete — 1,840 words, est. duration 10:24' },
  { ts: '14:45:01', level: 'INFO', msg: 'Sending to Story Architect for narrative review via gRPC' },
  { ts: '14:47:22', level: 'INFO', msg: 'Received narrative feedback — 2 revision suggestions' },
  { ts: '14:49:30', level: 'INFO', msg: 'Revisions applied. Final quality score: 8.7/10' },
  { ts: '14:49:31', level: 'INFO', msg: 'Script approved. Publishing to output queue.' },
];

const mockHistory = [
  { id: 'h1', task: 'Morning Routine for Devs', status: 'completed', duration: '18m', cost: '$2.40', time: '2h ago', quality: 9.1 },
  { id: 'h2', task: 'Python for Beginners Ep.4', status: 'completed', duration: '22m', cost: '$3.10', time: '8h ago', quality: 8.8 },
  { id: 'h3', task: 'Machine Learning 101', status: 'failed', duration: '12m', cost: '$1.80', time: '3h ago', quality: 0 },
  { id: 'h4', task: 'React Hooks Deep Dive', status: 'completed', duration: '25m', cost: '$3.50', time: '1d ago', quality: 9.3 },
  { id: 'h5', task: 'AI Ethics Discussion', status: 'completed', duration: '20m', cost: '$2.90', time: '1d ago', quality: 8.5 },
];

export default function AgentDetail() {
  const { agentId } = useParams();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const agent = mockAgents.find((a) => a.id === agentId);
  const spec = agentSpecs.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-atlas-text-dim">Agent not found</p>
        <Link to="/agents" className="text-atlas-accent text-sm mt-2 hover:underline">← Back to agents</Link>
      </div>
    );
  }

  const Icon = getAgentIcon(agent.id);
  const color = getAgentColor(agent.id);
  const sc = statusConfig[agent.status];
  const pc = phaseConfig[agent.phase];

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* Back + Header */}
      <Link to="/agents" className="inline-flex items-center gap-1.5 text-xs text-atlas-text-dim hover:text-atlas-accent transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Agent Center
      </Link>

      <div className="flex flex-col sm:flex-row items-start gap-4 bg-atlas-surface border border-atlas-border rounded-lg p-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-atlas-text-bright">{agent.name}</h1>
            <Badge color={sc.color}><StatusDot status={agent.status} size="xs" /> {sc.label}</Badge>
            <Badge color={pc.color}>{pc.label}</Badge>
          </div>
          <p className="text-sm text-atlas-text-dim">{agent.description}</p>
          {agent.currentTask && (
            <div className="mt-2 text-xs font-mono text-atlas-accent bg-atlas-accent/8 rounded px-2.5 py-1.5 inline-block">
              ▶ {agent.currentTask}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono text-atlas-text-dim">MODEL</div>
          <div className="text-sm font-mono text-atlas-text-bright">{agent.model}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-atlas-surface border border-atlas-border rounded-lg p-1">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              activeTab === tab ? 'bg-atlas-accent/15 text-atlas-accent' : 'text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface2'
            )}
          >
            {tab === 'Overview' && <Layers className="w-3 h-3" />}
            {tab === 'Memory' && <Database className="w-3 h-3" />}
            {tab === 'History' && <History className="w-3 h-3" />}
            {tab === 'Logs' && <Terminal className="w-3 h-3" />}
            {tab === 'Config' && <Settings2 className="w-3 h-3" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <MetricCard label="Completed Today" value={String(agent.completedToday)} color="#22c55e" />
            <MetricCard label="Failed Today" value={String(agent.failedToday)} color="#ef4444" />
            <MetricCard label="Avg Latency" value={`${(agent.avgLatencyMs / 1000).toFixed(1)}s`} color="#3b82f6" />
            <MetricCard label="Cost Today" value={`$${agent.costToday}`} color="#f59e0b" />
            <MetricCard label="API Calls" value={String(agent.apiCallsToday)} color="#8b5cf6" />
            <MetricCard label="Success Rate" value={`${agent.successRate}%`} color={agent.successRate > 95 ? '#22c55e' : '#f59e0b'} />
          </div>
          {spec && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4">
                <SectionLabel>Inputs</SectionLabel>
                <div className="space-y-1.5">{spec.inputs.map((inp, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-atlas-text-dim"><span className="text-emerald-400 mt-0.5 shrink-0">→</span>{inp}</div>
                ))}</div>
              </div>
              <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4">
                <SectionLabel>Outputs</SectionLabel>
                <div className="space-y-1.5">{spec.outputs.map((out, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-atlas-text-dim"><span className="text-blue-400 mt-0.5 shrink-0">←</span>{out}</div>
                ))}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Memory' && (
        <div className="space-y-3">
          {mockMemory.filter((m) => m.source === agent.name || Math.random() > 0.5).slice(0, 6).map((mem) => (
            <div key={mem.id} className="bg-atlas-surface border border-atlas-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge color={mem.type === 'learning' ? '#3b82f6' : mem.type === 'mistake' ? '#ef4444' : mem.type === 'pattern' ? '#a855f7' : '#22c55e'}>{mem.type}</Badge>
                <span className="text-[10px] font-mono text-atlas-text-dim">Confidence: {(mem.confidence * 100).toFixed(0)}%</span>
                <span className="text-[10px] font-mono text-atlas-text-dim ml-auto">{mem.accesses} accesses</span>
              </div>
              <p className="text-sm text-atlas-text">{mem.content}</p>
              <div className="flex gap-1.5 mt-2">{mem.tags.map((t) => <span key={t} className="text-[9px] font-mono bg-atlas-surface2 text-atlas-text-dim px-1.5 py-0.5 rounded">{t}</span>)}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'History' && (
        <div className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono text-atlas-text-dim uppercase border-b border-atlas-border">
                <th className="text-left px-4 py-2.5 font-medium">Task</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Duration</th>
                <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Quality</th>
                <th className="text-right px-4 py-2.5 font-medium">Cost</th>
                <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">Time</th>
              </tr>
            </thead>
            <tbody>
              {mockHistory.map((h) => (
                <tr key={h.id} className="border-b border-atlas-border/50 hover:bg-atlas-surface2/30">
                  <td className="px-4 py-2.5 text-atlas-text-bright">{h.task}</td>
                  <td className="px-3 py-2.5"><Badge color={h.status === 'completed' ? '#22c55e' : '#ef4444'}>{h.status}</Badge></td>
                  <td className="px-3 py-2.5 font-mono text-atlas-text-dim hidden sm:table-cell">{h.duration}</td>
                  <td className="px-3 py-2.5 hidden md:table-cell">{h.quality > 0 ? <span className="font-mono text-atlas-text-bright">{h.quality}/10</span> : <span className="text-atlas-text-dim">-</span>}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-atlas-text-dim">{h.cost}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-atlas-text-dim hidden lg:table-cell">{h.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Logs' && (
        <div className="bg-atlas-bg border border-atlas-border rounded-lg p-4 font-mono text-xs space-y-1 max-h-[500px] overflow-y-auto">
          {mockLogs.map((log, i) => (
            <div key={i} className="flex gap-3 hover:bg-atlas-surface2/20 px-2 py-0.5 rounded">
              <span className="text-atlas-text-dim shrink-0">{log.ts}</span>
              <span className={cn('shrink-0 w-12',
                log.level === 'INFO' ? 'text-blue-400' : log.level === 'WARN' ? 'text-amber-400' : log.level === 'DEBUG' ? 'text-slate-500' : 'text-red-400'
              )}>{log.level}</span>
              <span className="text-atlas-text">{log.msg}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-atlas-text-dim mt-2 pt-2 border-t border-atlas-border/50">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Streaming live...</span>
          </div>
        </div>
      )}

      {activeTab === 'Config' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4 space-y-4">
            <SectionLabel>Model Configuration</SectionLabel>
            {[
              { label: 'Primary Model', value: agent.model },
              { label: 'Temperature', value: '0.7' },
              { label: 'Max Tokens', value: '4,096' },
              { label: 'Top P', value: '0.9' },
              { label: 'Retry Limit', value: '3' },
              { label: 'Timeout', value: '120s' },
            ].map((cfg) => (
              <div key={cfg.label} className="flex items-center justify-between">
                <span className="text-xs text-atlas-text-dim">{cfg.label}</span>
                <span className="text-xs font-mono text-atlas-text-bright bg-atlas-surface2 px-2 py-1 rounded">{cfg.value}</span>
              </div>
            ))}
          </div>
          <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4 space-y-4">
            <SectionLabel>Resource Allocation</SectionLabel>
            {[
              { label: 'Memory Limit', value: `${agent.memoryMb}MB` },
              { label: 'Uptime', value: `${agent.uptimeHrs}h` },
              { label: 'Queue Priority', value: 'Normal' },
              { label: 'Concurrent Tasks', value: '1' },
              { label: 'Auto-scale', value: 'Enabled' },
              { label: 'Health Check', value: '30s interval' },
            ].map((cfg) => (
              <div key={cfg.label} className="flex items-center justify-between">
                <span className="text-xs text-atlas-text-dim">{cfg.label}</span>
                <span className="text-xs font-mono text-atlas-text-bright bg-atlas-surface2 px-2 py-1 rounded">{cfg.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
