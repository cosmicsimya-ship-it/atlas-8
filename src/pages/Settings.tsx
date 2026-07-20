import { Key, Cpu, HardDrive, DollarSign, Plug, Loader2, CheckCircle2, XCircle, RefreshCw, Server, Terminal } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { SectionLabel, Badge, ProgressBar } from '../components/ui';
import { cn } from '../utils/cn';
import { aiProvider } from '../services/ai-provider';

// ── Static data (unchanged from original) ─────────────────────────────
const modelRouting = [
  { task: 'Script Writing', primary: 'gpt-4.1-mini', fallback: 'Mock', temperature: 0.8 },
  { task: 'Topic Discovery', primary: 'gpt-4.1-mini', fallback: 'Mock', temperature: 0.9 },
  { task: 'Visual Prompts', primary: 'gpt-4.1-mini', fallback: 'Mock', temperature: 0.7 },
  { task: 'SEO Optimization', primary: 'gpt-4.1-mini', fallback: 'Mock', temperature: 0.5 },
  { task: 'Thumbnail Design', primary: 'gpt-4.1-mini', fallback: 'Mock', temperature: 0.7 },
  { task: 'Image Generation', primary: 'DALL-E 3', fallback: 'Mock', temperature: 0 },
  { task: 'Narration', primary: 'ElevenLabs', fallback: 'Mock', temperature: 0 },
];

const integrations = [
  { name: 'YouTube Studio', status: 'connected', lastSync: '5m ago', icon: '🎬' },
  { name: 'Google Analytics 4', status: 'connected', lastSync: '1h ago', icon: '📊' },
  { name: 'TikTok Creator', status: 'disconnected', lastSync: 'Never', icon: '🎵' },
  { name: 'Instagram Graph API', status: 'disconnected', lastSync: 'Never', icon: '📸' },
  { name: 'Twitter/X API', status: 'connected', lastSync: '2h ago', icon: '🐦' },
  { name: 'Discord Webhook', status: 'connected', lastSync: '10m ago', icon: '💬' },
];

// ═══════════════════════════════════════════════════════════════════════
// Backend Connection Status Component
// ═══════════════════════════════════════════════════════════════════════
function BackendStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'no-key' | 'offline'>('checking');
  const [model, setModel] = useState('');
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus('checking');
    aiProvider.resetDetection();

    try {
      const res = await fetch('http://localhost:3001/api/ai/health', {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) { setStatus('offline'); setChecking(false); return; }
      const data = await res.json();
      setModel(data.model || '');
      setStatus(data.configured ? 'connected' : 'no-key');
    } catch {
      setStatus('offline');
    }
    setChecking(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  const statusColor = status === 'connected' ? '#22c55e' : status === 'no-key' ? '#f59e0b' : status === 'checking' ? '#3b82f6' : '#ef4444';
  const statusLabel = status === 'connected' ? 'Connected' : status === 'no-key' ? 'No API Key' : status === 'checking' ? 'Checking…' : 'Offline';

  return (
    <div className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-atlas-border">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-atlas-text-dim" />
          <SectionLabel>AI Backend Connection</SectionLabel>
        </div>
        <button
          onClick={check}
          disabled={checking}
          className="flex items-center gap-1.5 text-[10px] text-atlas-text-dim hover:text-atlas-text transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3 h-3', checking && 'animate-spin')} />
          Re-check
        </button>
      </div>

      {/* Status indicator */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
            {status === 'checking' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: statusColor }} />}
            {status === 'connected' && <CheckCircle2 className="w-5 h-5" style={{ color: statusColor }} />}
            {status === 'no-key' && <Key className="w-5 h-5" style={{ color: statusColor }} />}
            {status === 'offline' && <XCircle className="w-5 h-5" style={{ color: statusColor }} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-atlas-text-bright">ATLAS Backend</span>
              <Badge color={statusColor}>{statusLabel}</Badge>
            </div>
            <span className="text-[10px] font-mono text-atlas-text-dim">
              {status === 'connected' && `Model: ${model} · http://localhost:3001`}
              {status === 'no-key' && 'Server running but OPENAI_API_KEY not set in .env'}
              {status === 'offline' && 'Backend server not running'}
              {status === 'checking' && 'Detecting backend server…'}
            </span>
          </div>
        </div>

        {/* Security notice */}
        <div className="bg-atlas-surface2/30 rounded-lg p-3 mb-4">
          <p className="text-[10px] text-atlas-text-dim leading-relaxed">
            <span className="text-atlas-accent font-semibold">Security:</span> Your OpenAI API key is stored in the server's <code className="text-atlas-text font-mono">.env</code> file. It never reaches the browser. The frontend sends prompts to the local backend, which injects the key server-side before forwarding to OpenAI.
          </p>
        </div>

        {/* Setup instructions */}
        {status !== 'connected' && (
          <div className="bg-atlas-bg/60 rounded-lg border border-atlas-border/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-3.5 h-3.5 text-atlas-accent" />
              <span className="text-xs font-semibold text-atlas-text-bright">Setup Instructions</span>
            </div>
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-start gap-2">
                <span className="text-atlas-accent shrink-0 mt-0.5">1.</span>
                <div>
                  <span className="text-atlas-text">cp .env.example .env</span>
                  <span className="text-atlas-text-dim/60 ml-2">— copy config template</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-atlas-accent shrink-0 mt-0.5">2.</span>
                <div>
                  <span className="text-atlas-text">OPENAI_API_KEY=sk-...</span>
                  <span className="text-atlas-text-dim/60 ml-2">— add your key to .env</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-atlas-accent shrink-0 mt-0.5">3.</span>
                <div>
                  <span className="text-atlas-text">node server/index.js</span>
                  <span className="text-atlas-text-dim/60 ml-2">— start backend on :3001</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-atlas-accent shrink-0 mt-0.5">4.</span>
                <div>
                  <span className="text-atlas-text">Click "Re-check" above</span>
                  <span className="text-atlas-text-dim/60 ml-2">— verify connection</span>
                </div>
              </div>
            </div>
            {status === 'no-key' && (
              <div className="mt-3 pt-3 border-t border-atlas-border/50">
                <p className="text-[10px] text-amber-400">Server is running but needs an API key. Add <code className="font-mono">OPENAI_API_KEY=sk-...</code> to your <code className="font-mono">.env</code> file and restart the server.</p>
              </div>
            )}
          </div>
        )}

        {/* Connected — show model info */}
        {status === 'connected' && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-atlas-surface2/50 rounded-lg p-3 text-center border border-atlas-border/50">
              <div className="text-[9px] font-mono text-atlas-text-dim uppercase">Provider</div>
              <div className="text-sm font-bold text-emerald-400">OpenAI</div>
            </div>
            <div className="bg-atlas-surface2/50 rounded-lg p-3 text-center border border-atlas-border/50">
              <div className="text-[9px] font-mono text-atlas-text-dim uppercase">Model</div>
              <div className="text-sm font-bold text-atlas-text-bright">{model}</div>
            </div>
            <div className="bg-atlas-surface2/50 rounded-lg p-3 text-center border border-atlas-border/50">
              <div className="text-[9px] font-mono text-atlas-text-dim uppercase">Endpoint</div>
              <div className="text-sm font-bold text-atlas-text-bright">:3001</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════════════════════════════════
export default function Settings() {
  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h2 className="text-lg font-semibold text-atlas-text-bright">Settings</h2>
        <p className="text-xs text-atlas-text-dim mt-0.5">System configuration · Backend connection · Model routing · Integrations</p>
      </div>

      {/* ── Backend Connection ──────────────────────────────────────────── */}
      <BackendStatus />

      {/* Model Routing — preserved exactly */}
      <div className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-atlas-border">
          <Cpu className="w-4 h-4 text-atlas-text-dim" />
          <SectionLabel>Model Routing</SectionLabel>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-mono text-atlas-text-dim uppercase border-b border-atlas-border">
              <th className="text-left px-4 py-2 font-medium">Task</th>
              <th className="text-left px-3 py-2 font-medium">Primary Model</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Fallback</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Temperature</th>
            </tr>
          </thead>
          <tbody>
            {modelRouting.map((route) => (
              <tr key={route.task} className="border-b border-atlas-border/50 hover:bg-atlas-surface2/30">
                <td className="px-4 py-2.5 text-atlas-text-bright">{route.task}</td>
                <td className="px-3 py-2.5"><Badge color="#a855f7">{route.primary}</Badge></td>
                <td className="px-3 py-2.5 hidden sm:table-cell"><Badge color="#94a3b8">{route.fallback}</Badge></td>
                <td className="px-3 py-2.5 font-mono text-atlas-text-dim hidden md:table-cell">{route.temperature}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Storage + Cost Row — preserved exactly */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-atlas-text-dim" />
            <SectionLabel>Storage</SectionLabel>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Videos', used: '8.4 GB', percent: 42, color: '#3b82f6' },
              { label: 'Images', used: '1.2 GB', percent: 6, color: '#f97316' },
              { label: 'Audio', used: '1.2 GB', percent: 6, color: '#14b8a6' },
              { label: 'Database', used: '890 MB', percent: 4.5, color: '#a855f7' },
              { label: 'Vector Store', used: '340 MB', percent: 1.7, color: '#8b5cf6' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-xs text-atlas-text-dim w-20">{s.label}</span>
                <ProgressBar value={s.percent} color={s.color} />
                <span className="text-[10px] font-mono text-atlas-text-dim w-14 text-right">{s.used}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-atlas-border/50 flex items-center justify-between">
            <span className="text-xs text-atlas-text-dim">Total: 12.0 GB / 20 GB</span>
            <ProgressBar value={60} color="#3b82f6" height="h-1" />
          </div>
        </div>

        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-atlas-text-dim" />
            <SectionLabel>Cost Tracking</SectionLabel>
          </div>
          <div className="space-y-3">
            {[
              { label: 'LLM APIs', cost: '$45.20', budget: '$150', percent: 30 },
              { label: 'Image Gen', cost: '$18.60', budget: '$50', percent: 37 },
              { label: 'Voice Synth', cost: '$8.40', budget: '$30', percent: 28 },
              { label: 'Storage', cost: '$6.80', budget: '$20', percent: 34 },
              { label: 'Infrastructure', cost: '$3.30', budget: '$25', percent: 13 },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-3">
                <span className="text-xs text-atlas-text-dim w-24">{c.label}</span>
                <ProgressBar value={c.percent} color={c.percent > 80 ? '#ef4444' : c.percent > 50 ? '#f59e0b' : '#22c55e'} />
                <span className="text-[10px] font-mono text-atlas-text-dim w-20 text-right">{c.cost}/{c.budget}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-atlas-border/50 flex items-center justify-between">
            <span className="text-xs text-atlas-text-dim">MTD Total: $82.30</span>
            <span className="text-xs font-mono text-emerald-400">Budget: $275</span>
          </div>
        </div>
      </div>

      {/* Integrations — preserved exactly */}
      <div className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-atlas-border">
          <Plug className="w-4 h-4 text-atlas-text-dim" />
          <SectionLabel>Integrations</SectionLabel>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {integrations.map((integ) => (
            <div key={integ.name} className={cn(
              'flex items-center gap-3 rounded-lg p-3 border transition-colors',
              integ.status === 'connected' ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-atlas-surface2/30 border-atlas-border'
            )}>
              <span className="text-lg">{integ.icon}</span>
              <div className="flex-1">
                <div className="text-xs font-medium text-atlas-text-bright">{integ.name}</div>
                <div className="text-[10px] text-atlas-text-dim">Last sync: {integ.lastSync}</div>
              </div>
              <Badge color={integ.status === 'connected' ? '#22c55e' : '#94a3b8'}>{integ.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
