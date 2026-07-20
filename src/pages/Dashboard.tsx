import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, DollarSign, Gauge, XCircle } from 'lucide-react';
import { mockAgents, mockPipelines, mockActivity, systemMetrics } from '../data/mockData';
import { getAgentIcon, getAgentColor, statusConfig, phaseConfig } from '../utils/agentHelpers';
import { MetricCard, StatusDot, Badge, ProgressBar, MiniBar, SectionLabel } from '../components/ui';
import { cn } from '../utils/cn';

const revenueData = [180, 220, 340, 290, 420, 380, 342];

export default function Dashboard() {
  const activePipelines = mockPipelines.filter((p) => p.status === 'processing' || p.status === 'review');
  const onlineAgents = mockAgents.filter((a) => a.status !== 'offline');

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* System Health Bar */}
      <div className="flex items-center gap-4 bg-atlas-surface border border-atlas-border rounded-lg px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400">System Health</span>
        </div>
        <div className="flex-1">
          <ProgressBar value={systemMetrics.systemUptime} color="#22c55e" height="h-1.5" />
        </div>
        <span className="text-sm font-mono font-bold text-emerald-400">{systemMetrics.systemUptime}%</span>
        <div className="hidden sm:flex items-center gap-3 ml-4 border-l border-atlas-border pl-4">
          <span className="flex items-center gap-1 text-[11px] font-mono text-atlas-text-dim">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {systemMetrics.completedToday}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-atlas-text-dim">
            <XCircle className="w-3 h-3 text-red-400" /> {systemMetrics.failedToday}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-atlas-text-dim">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> {mockAgents.filter((a) => a.status === 'error').length}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Agents Online" value={`${systemMetrics.agentsOnline}/${systemMetrics.agentsTotal}`} color="#22c55e" trend="neutral" sub="12 active" />
        <MetricCard label="Active Pipelines" value={String(systemMetrics.activePipelines)} color="#3b82f6" trend="up" sub="3 channels" />
        <MetricCard label="Completed Today" value={String(systemMetrics.completedToday)} color="#8b5cf6" trend="up" sub="+15% vs avg" />
        <MetricCard label="Failed Today" value={String(systemMetrics.failedToday)} color="#ef4444" trend="down" sub="1 retrying" />
        <MetricCard label="Cost Today" value={`$${systemMetrics.costToday}`} color="#f59e0b" trend="neutral" sub="$2.4K MTD" />
        <MetricCard label="Est. Revenue" value={`$${systemMetrics.estimatedRevenue}`} color="#10b981" trend="up" sub="$9.8K MTD" />
      </div>

      {/* Main Content: Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Pipelines */}
        <div className="lg:col-span-2 bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-atlas-border">
            <SectionLabel>Active Pipelines</SectionLabel>
            <Link to="/queue" className="text-[11px] text-atlas-accent hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono text-atlas-text-dim uppercase border-b border-atlas-border">
                  <th className="text-left px-4 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Channel</th>
                  <th className="text-left px-3 py-2 font-medium">Phase</th>
                  <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Agent</th>
                  <th className="text-left px-3 py-2 font-medium w-36">Progress</th>
                  <th className="text-right px-4 py-2 font-medium hidden lg:table-cell">Cost</th>
                </tr>
              </thead>
              <tbody>
                {activePipelines.map((pl) => {
                  const phaseC = phaseConfig[pl.phase];
                  return (
                    <tr key={pl.id} className="border-b border-atlas-border/50 hover:bg-atlas-surface2/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <StatusDot status={pl.status === 'review' ? 'warning' : 'processing'} size="xs" />
                          <span className="text-atlas-text-bright font-medium truncate max-w-[200px]">{pl.title}</span>
                          {pl.priority === 'high' && <Badge color="#f59e0b">HIGH</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-atlas-text-dim hidden sm:table-cell">{pl.channelName}</td>
                      <td className="px-3 py-2.5"><Badge color={phaseC.color}>{phaseC.label}</Badge></td>
                      <td className="px-3 py-2.5 text-atlas-text-dim hidden md:table-cell">{pl.agentName}</td>
                      <td className="px-3 py-2.5"><ProgressBar value={pl.progress} color={phaseC.color} showLabel /></td>
                      <td className="px-4 py-2.5 text-right text-atlas-text-dim font-mono hidden lg:table-cell">${pl.cost.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agent Status Grid */}
        <div className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-atlas-border">
            <SectionLabel>Agent Status</SectionLabel>
            <Link to="/agents" className="text-[11px] text-atlas-accent hover:underline flex items-center gap-1">
              All agents <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-atlas-border/50 max-h-[340px] overflow-y-auto">
            {onlineAgents.map((agent) => {
              const Icon = getAgentIcon(agent.id);
              const color = getAgentColor(agent.id);
              const sc = statusConfig[agent.status];
              return (
                <Link key={agent.id} to={`/agents/${agent.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-atlas-surface2/30 transition-colors">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-atlas-text-bright truncate">{agent.name}</div>
                    <div className="text-[10px] text-atlas-text-dim truncate">{agent.currentTask || 'Idle'}</div>
                  </div>
                  <StatusDot status={agent.status} size="xs" />
                  <span className="text-[10px] font-mono w-14 text-right" style={{ color: sc.color }}>{sc.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Activity + Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-atlas-border">
            <SectionLabel>Recent Activity</SectionLabel>
          </div>
          <div className="divide-y divide-atlas-border/50 max-h-[280px] overflow-y-auto">
            {mockActivity.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
                <Activity className={cn('w-3.5 h-3.5 mt-0.5 shrink-0',
                  ev.variant === 'success' ? 'text-emerald-400' : ev.variant === 'error' ? 'text-red-400' : ev.variant === 'warning' ? 'text-amber-400' : 'text-blue-400'
                )} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-atlas-text">{ev.message}</span>
                </div>
                <span className="text-[10px] font-mono text-atlas-text-dim shrink-0">{ev.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Mini */}
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4">
          <SectionLabel>7-Day Revenue</SectionLabel>
          <div className="flex items-end gap-3 mb-3">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="text-2xl font-bold font-mono text-emerald-400">$2,172</span>
            <span className="text-xs font-mono text-emerald-400/70 mb-0.5">+12.3%</span>
          </div>
          <MiniBar data={revenueData} color="#10b981" height={80} />
          <div className="flex justify-between mt-2 text-[9px] font-mono text-atlas-text-dim">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>
      </div>
    </div>
  );
}
