import { DollarSign, Eye, ArrowUp, ArrowDown } from 'lucide-react';
import { mockChannels } from '../data/mockData';
import { MetricCard, MiniBar, SectionLabel, Badge, ProgressBar } from '../components/ui';

const revenueWeekly = [180, 220, 340, 290, 420, 380, 342];
const viewsWeekly = [12400, 18200, 15100, 22300, 30100, 25400, 28700];
const subscribersWeekly = [45, 62, 38, 71, 89, 55, 67];
const ctrWeekly = [5.2, 5.8, 6.1, 5.9, 6.8, 6.5, 6.7];

const topVideos = [
  { title: 'Python for Beginners Ep.3', views: '45.2K', ctr: '7.8%', retention: '56%', revenue: '$142', trend: 'up' as const },
  { title: 'AI Tools You Need in 2026', views: '38.9K', ctr: '8.2%', retention: '52%', revenue: '$118', trend: 'up' as const },
  { title: 'React Hooks Deep Dive', views: '22.1K', ctr: '6.1%', retention: '48%', revenue: '$67', trend: 'down' as const },
  { title: 'Crypto Market Update', views: '18.4K', ctr: '5.4%', retention: '41%', revenue: '$54', trend: 'neutral' as const },
  { title: 'Morning Routine for Devs', views: '15.7K', ctr: '5.9%', retention: '45%', revenue: '$48', trend: 'up' as const },
];

export default function Analytics() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h2 className="text-lg font-semibold text-atlas-text-bright">Analytics</h2>
        <p className="text-xs text-atlas-text-dim mt-0.5">Cross-channel performance intelligence · Last 7 days</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Revenue" value="$2,172" color="#10b981" trend="up" sub="+12.3% vs last week" />
        <MetricCard label="Total Views" value="152K" color="#3b82f6" trend="up" sub="+8.7% vs last week" />
        <MetricCard label="Avg CTR" value="6.1%" color="#f59e0b" trend="up" sub="+0.4pp improvement" />
        <MetricCard label="Avg Retention" value="48.2%" color="#a855f7" trend="neutral" sub="Stable" />
        <MetricCard label="New Subscribers" value="+427" color="#22c55e" trend="up" sub="+15.2% growth" />
        <MetricCard label="Watch Time" value="4,280h" color="#06b6d4" trend="up" sub="+11% vs last week" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Chart */}
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Weekly Revenue</SectionLabel>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-lg font-bold font-mono text-emerald-400">$2,172</span>
              <Badge color="#22c55e"><ArrowUp className="w-2.5 h-2.5" /> 12.3%</Badge>
            </div>
          </div>
          <MiniBar data={revenueWeekly} color="#10b981" height={120} />
          <div className="flex justify-between mt-2 text-[9px] font-mono text-atlas-text-dim">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>

        {/* Views Chart */}
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Weekly Views</SectionLabel>
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-lg font-bold font-mono text-blue-400">152K</span>
              <Badge color="#3b82f6"><ArrowUp className="w-2.5 h-2.5" /> 8.7%</Badge>
            </div>
          </div>
          <MiniBar data={viewsWeekly} color="#3b82f6" height={120} />
          <div className="flex justify-between mt-2 text-[9px] font-mono text-atlas-text-dim">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-5">
          <SectionLabel>New Subscribers / Day</SectionLabel>
          <MiniBar data={subscribersWeekly} color="#22c55e" height={80} />
          <div className="flex justify-between mt-2 text-[9px] font-mono text-atlas-text-dim">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-5">
          <SectionLabel>CTR Trend (%)</SectionLabel>
          <MiniBar data={ctrWeekly.map((v) => v * 20)} color="#f59e0b" height={80} />
          <div className="flex justify-between mt-2 text-[9px] font-mono text-atlas-text-dim">
            {ctrWeekly.map((v, i) => <span key={i}>{v}%</span>)}
          </div>
        </div>
      </div>

      {/* Top Videos + Channel Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-atlas-border"><SectionLabel>Top Performing Videos</SectionLabel></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono text-atlas-text-dim uppercase border-b border-atlas-border">
                <th className="text-left px-4 py-2 font-medium">Title</th>
                <th className="text-right px-3 py-2 font-medium">Views</th>
                <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">CTR</th>
                <th className="text-right px-3 py-2 font-medium hidden md:table-cell">Retention</th>
                <th className="text-right px-4 py-2 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topVideos.map((vid, i) => (
                <tr key={i} className="border-b border-atlas-border/50 hover:bg-atlas-surface2/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-atlas-text-bright">{vid.title}</span>
                      {vid.trend === 'up' && <ArrowUp className="w-3 h-3 text-emerald-400" />}
                      {vid.trend === 'down' && <ArrowDown className="w-3 h-3 text-red-400" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-atlas-text-dim">{vid.views}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-atlas-text-dim hidden sm:table-cell">{vid.ctr}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-atlas-text-dim hidden md:table-cell">{vid.retention}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{vid.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Channel Comparison */}
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4">
          <SectionLabel>Channel Comparison</SectionLabel>
          <div className="space-y-4 mt-2">
            {mockChannels.map((ch) => (
              <div key={ch.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-atlas-text-bright">{ch.name}</span>
                  <span className="text-xs font-mono text-atlas-text-dim">{ch.subscribers}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2"><span className="text-[9px] w-12 text-atlas-text-dim">CTR</span><ProgressBar value={ch.ctr * 10} color="#f59e0b" /><span className="text-[10px] font-mono text-atlas-text-dim w-10 text-right">{ch.ctr}%</span></div>
                  <div className="flex items-center gap-2"><span className="text-[9px] w-12 text-atlas-text-dim">Retain</span><ProgressBar value={ch.retention} color="#a855f7" /><span className="text-[10px] font-mono text-atlas-text-dim w-10 text-right">{ch.retention}%</span></div>
                  <div className="flex items-center gap-2"><span className="text-[9px] w-12 text-atlas-text-dim">Growth</span><ProgressBar value={ch.growthRate * 5} color="#22c55e" /><span className="text-[10px] font-mono text-atlas-text-dim w-10 text-right">+{ch.growthRate}%</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
