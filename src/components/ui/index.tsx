import { cn } from '../../utils/cn';

export function StatusDot({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' | 'md' }) {
  const colorMap: Record<string, string> = {
    online: 'bg-emerald-400', idle: 'bg-slate-400', processing: 'bg-blue-400',
    error: 'bg-red-400', paused: 'bg-amber-400', offline: 'bg-gray-600',
    success: 'bg-emerald-400', warning: 'bg-amber-400', info: 'bg-blue-400',
    active: 'bg-emerald-400', setup: 'bg-amber-400',
  };
  const sizeMap = { xs: 'w-1.5 h-1.5', sm: 'w-2 h-2', md: 'w-2.5 h-2.5' };
  const isAnimated = status === 'processing' || status === 'online' || status === 'active';
  return (
    <span className="relative inline-flex">
      {isAnimated && <span className={cn('absolute inline-flex rounded-full opacity-40 animate-ping', sizeMap[size], colorMap[status] || 'bg-slate-400')} />}
      <span className={cn('relative inline-flex rounded-full', sizeMap[size], colorMap[status] || 'bg-slate-400')} />
    </span>
  );
}

export function Badge({ children, color = '#94a3b8', className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium', className)}
      style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}25` }}
    >
      {children}
    </span>
  );
}

export function MetricCard({ label, value, sub, color = '#3b82f6', trend }: { label: string; value: string; sub?: string; color?: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4 hover:border-atlas-border-glow/30 transition-colors">
      <div className="text-xs text-atlas-text-dim font-medium mb-1">{label}</div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold font-mono" style={{ color }}>{value}</span>
        {trend && (
          <span className={cn('text-xs font-mono mb-0.5', trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400')}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {sub && <div className="text-[11px] text-atlas-text-dim mt-1 font-mono">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, color = '#3b82f6', height = 'h-1.5', showLabel = false }: { value: number; color?: string; height?: string; showLabel?: boolean }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className={cn('flex-1 bg-atlas-surface2 rounded-full overflow-hidden', height)}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
      {showLabel && <span className="text-xs font-mono text-atlas-text-dim w-9 text-right">{value}%</span>}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-mono font-semibold text-atlas-text-dim uppercase tracking-widest mb-3">{children}</h3>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded bg-atlas-surface2 border border-atlas-border text-[10px] font-mono text-atlas-text-dim">
      {children}
    </kbd>
  );
}

export function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-10 h-10 text-atlas-text-dim/30 mb-3" />
      <div className="text-sm font-medium text-atlas-text-dim">{title}</div>
      <div className="text-xs text-atlas-text-dim/60 mt-1">{sub}</div>
    </div>
  );
}

export function MiniBar({ data, color = '#3b82f6', height = 32 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all hover:opacity-80" style={{ height: `${(v / max) * 100}%`, backgroundColor: color, minHeight: 2, opacity: 0.7 + (i / data.length) * 0.3 }} />
      ))}
    </div>
  );
}
