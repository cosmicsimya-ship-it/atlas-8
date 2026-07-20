import { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Download, Copy, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight, Zap, Package, Hash } from 'lucide-react';
import { getAgentIcon, getAgentColor } from '../utils/agentHelpers';
import { mockChannels } from '../data/mockData';
import { StatusDot, Badge, ProgressBar } from '../components/ui';
import { cn } from '../utils/cn';
import { usePipeline } from '../hooks/usePipeline';
import type { StepStatus } from '../types/pipeline';

// ─── Status helpers (pure UI) ─────────────────────────────────────────
const statusColor = (s: StepStatus) =>
  s === 'completed' ? '#22c55e' : s === 'running' ? '#3b82f6' : s === 'failed' ? '#ef4444' : s === 'cancelled' ? '#f59e0b' : '#475569';
const statusLabel = (s: StepStatus) =>
  s === 'completed' ? 'Completed' : s === 'running' ? 'Running' : s === 'failed' ? 'Failed' : s === 'cancelled' ? 'Cancelled' : 'Queued';

const OUTPUT_TABS = ['Script', 'Visual Prompts', 'Thumbnail', 'SEO', 'Publishing'] as const;
type OutputTab = typeof OUTPUT_TABS[number];

// ═══════════════════════════════════════════════════════════════════════
// Component — UI only, all logic in usePipeline → PipelineEngine
// ═══════════════════════════════════════════════════════════════════════
export default function ShortsProduction() {
  const { status: pipelineState, steps, result, overallProgress, error, startPipeline, resetPipeline } = usePipeline();

  const [channelId, setChannelId] = useState('ch-1');
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [outputTab, setOutputTab] = useState<OutputTab>('Script');
  const [copied, setCopied] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const channel = mockChannels.find((c) => c.id === channelId) || mockChannels[0];

  // Auto-expand running step
  useEffect(() => {
    const running = steps.find((s) => s.status === 'running');
    if (running) setExpandedStep(running.id);
  }, [steps]);

  // Scroll log into view
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [steps]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRun = () => {
    startPipeline(channelId, channel.niche);
  };

  const handleReset = () => {
    resetPipeline();
    setExpandedStep(null);
  };

  // ═══════════════════════════════════════════════════════════════════
  // Render — identical to previous version's visual output
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-atlas-text-bright">Shorts Production Pipeline</h2>
              <p className="text-xs text-atlas-text-dim">6-step automated YouTube Shorts production · End-to-end content package</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-atlas-text-dim uppercase">Channel:</span>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              disabled={pipelineState === 'running'}
              className="h-8 px-2.5 rounded-md bg-atlas-surface2/60 border border-atlas-border text-xs text-atlas-text-bright outline-none focus:border-atlas-accent/40 disabled:opacity-50 cursor-pointer"
            >
              {mockChannels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {pipelineState === 'idle' && (
            <button onClick={handleRun}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 text-white text-sm font-semibold hover:from-rose-600 hover:to-orange-600 transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40"
            >
              <Play className="w-4 h-4" />
              Generate Shorts Package
            </button>
          )}
          {pipelineState === 'running' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-atlas-accent/15 text-atlas-accent text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Producing… {overallProgress}%
            </div>
          )}
          {(pipelineState === 'completed' || pipelineState === 'failed') && (
            <button onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-atlas-surface2 border border-atlas-border text-atlas-text-dim text-sm hover:text-atlas-text hover:border-atlas-accent/30 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              New Package
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {pipelineState !== 'idle' && (
        <div className="bg-atlas-surface border border-atlas-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-atlas-text-bright">Pipeline Progress</span>
              <Badge color={pipelineState === 'completed' ? '#22c55e' : pipelineState === 'running' ? '#3b82f6' : '#ef4444'}>
                {pipelineState === 'completed' ? 'Complete' : pipelineState === 'running' ? 'Running' : 'Failed'}
              </Badge>
            </div>
            <span className="text-xs font-mono text-atlas-text-dim">
              {channel.name} · {steps.filter((s) => s.status === 'completed').length}/{steps.length} steps
            </span>
          </div>
          <ProgressBar value={overallProgress} color={pipelineState === 'completed' ? '#22c55e' : '#3b82f6'} height="h-2" />
          <div className="flex items-center gap-1 mt-3">
            {steps.map((step) => (
              <div key={step.id} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-1 rounded-full" style={{ backgroundColor: statusColor(step.status) }} />
                <span className="text-[8px] font-mono text-atlas-text-dim truncate max-w-full text-center">{step.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Steps */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const Icon = getAgentIcon(step.agentId);
          const color = getAgentColor(step.agentId);
          const isExpanded = expandedStep === step.id;
          const isActive = step.status === 'running' || step.status === 'completed' || step.status === 'failed';

          return (
            <div key={step.id}
              className={cn(
                'bg-atlas-surface border rounded-lg overflow-hidden transition-all',
                step.status === 'running' ? 'border-atlas-accent/40 shadow-lg shadow-atlas-accent/5' :
                step.status === 'completed' ? 'border-emerald-500/20' :
                step.status === 'failed' ? 'border-red-500/30' :
                'border-atlas-border'
              )}
            >
              <button
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-atlas-surface2/20 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: `${statusColor(step.status)}18`, color: statusColor(step.status), border: `1.5px solid ${statusColor(step.status)}40` }}>
                  {step.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                   step.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                   step.status === 'failed' ? <XCircle className="w-3.5 h-3.5" /> :
                   idx + 1}
                </div>
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}12` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-atlas-text-bright">{step.label}</div>
                  <div className="text-[10px] text-atlas-text-dim">{step.agentName}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {step.status === 'running' && <StatusDot status="processing" size="sm" />}
                  <Badge color={statusColor(step.status)}>{statusLabel(step.status)}</Badge>
                  {step.durationMs > 0 && (
                    <span className="text-[10px] font-mono text-atlas-text-dim flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{(step.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-atlas-text-dim" /> : <ChevronRight className="w-3.5 h-3.5 text-atlas-text-dim" />}
                </div>
              </button>

              {isExpanded && isActive && (
                <div className="border-t border-atlas-border/50 bg-atlas-bg/60">
                  <div className="px-4 py-2 max-h-48 overflow-y-auto font-mono text-[11px] space-y-0.5">
                    {step.logs.length === 0 && step.status === 'running' && (
                      <div className="text-atlas-text-dim flex items-center gap-2 py-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Initializing agent…
                      </div>
                    )}
                    {step.logs.map((entry, li) => (
                      <div key={li} className="flex gap-2.5 hover:bg-atlas-surface2/20 px-1 py-0.5 rounded">
                        <span className="text-atlas-text-dim/60 shrink-0 w-16">{entry.ts}</span>
                        <span className={cn('shrink-0 w-10',
                          entry.level === 'INFO' ? 'text-blue-400' : entry.level === 'WARN' ? 'text-amber-400' :
                          entry.level === 'DEBUG' ? 'text-slate-500' : 'text-red-400'
                        )}>{entry.level}</span>
                        <span className="text-atlas-text">{entry.msg}</span>
                      </div>
                    ))}
                    {step.status === 'running' && (
                      <div className="flex items-center gap-2 text-atlas-accent py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-atlas-accent animate-pulse" />
                        Processing…
                      </div>
                    )}
                    {step.error && (
                      <div className="flex items-center gap-2 text-red-400 py-1">
                        <XCircle className="w-3 h-3" />
                        {step.error}
                      </div>
                    )}
                    <div ref={isExpanded ? logEndRef : undefined} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Output Package ─────────────────────────────────────────── */}
      {pipelineState === 'completed' && result && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <Package className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-atlas-text-bright">Shorts Package Ready</h3>
                  <p className="text-xs text-atlas-text-dim mt-0.5">{channel.name} · {result.totalDuration} · Est. cost: {result.estimatedCost}</p>
                </div>
              </div>
              <button
                onClick={() => copyText(JSON.stringify(result, null, 2), 'package')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-atlas-surface2 border border-atlas-border text-xs text-atlas-text-dim hover:text-atlas-text transition-colors"
              >
                {copied === 'package' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Download className="w-3 h-3" />}
                {copied === 'package' ? 'Copied JSON' : 'Export JSON'}
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-[9px] font-mono text-emerald-400/60 uppercase tracking-wider">Topic</span>
                <p className="text-sm font-semibold text-atlas-text-bright">{result.topic}</p>
              </div>
              <div>
                <span className="text-[9px] font-mono text-emerald-400/60 uppercase tracking-wider">Hook</span>
                <p className="text-sm text-atlas-text italic">{result.hook}</p>
              </div>
            </div>
          </div>

          {/* Output Tabs */}
          <div className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
            <div className="flex gap-0 border-b border-atlas-border">
              {OUTPUT_TABS.map((tab) => (
                <button key={tab} onClick={() => setOutputTab(tab)}
                  className={cn('px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px',
                    outputTab === tab
                      ? 'text-atlas-accent border-atlas-accent bg-atlas-accent/5'
                      : 'text-atlas-text-dim border-transparent hover:text-atlas-text hover:bg-atlas-surface2/30'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-5">
              {outputTab === 'Script' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-atlas-text-dim">Full script · {result.totalDuration}</span>
                    <button onClick={() => copyText(result.script, 'script')} className="flex items-center gap-1 text-[10px] text-atlas-text-dim hover:text-atlas-accent transition-colors">
                      {copied === 'script' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied === 'script' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-sm text-atlas-text leading-relaxed whitespace-pre-wrap bg-atlas-bg/60 rounded-lg p-4 border border-atlas-border/50 font-sans max-h-[400px] overflow-y-auto">
                    {result.script}
                  </pre>
                </div>
              )}

              {outputTab === 'Visual Prompts' && (
                <div className="space-y-3">
                  {result.visualPrompts.map((vp) => (
                    <div key={vp.scene} className="bg-atlas-bg/60 rounded-lg p-4 border border-atlas-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge color="#06b6d4">Scene {vp.scene}</Badge>
                          <span className="text-[10px] font-mono text-atlas-text-dim">{vp.duration}</span>
                        </div>
                        <button onClick={() => copyText(vp.prompt, `scene-${vp.scene}`)} className="flex items-center gap-1 text-[10px] text-atlas-text-dim hover:text-atlas-accent transition-colors">
                          {copied === `scene-${vp.scene}` ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copied === `scene-${vp.scene}` ? 'Copied' : 'Copy prompt'}
                        </button>
                      </div>
                      <p className="text-sm text-atlas-text leading-relaxed">{vp.prompt}</p>
                    </div>
                  ))}
                </div>
              )}

              {outputTab === 'Thumbnail' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-atlas-text-dim">Thumbnail Concept Brief</span>
                    <button onClick={() => copyText(result.thumbnailConcept, 'thumb')} className="flex items-center gap-1 text-[10px] text-atlas-text-dim hover:text-atlas-accent transition-colors">
                      {copied === 'thumb' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied === 'thumb' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-atlas-bg/60 rounded-lg p-4 border border-atlas-border/50">
                    <p className="text-sm text-atlas-text leading-relaxed">{result.thumbnailConcept}</p>
                  </div>
                  <div className="mt-4 bg-amber-500/8 border border-amber-500/15 rounded-lg p-3">
                    <span className="text-[10px] font-mono text-amber-400/80 uppercase">Predicted CTR</span>
                    <div className="text-lg font-bold font-mono text-amber-400">7.8%</div>
                    <span className="text-[10px] text-atlas-text-dim">+28% above channel average (6.1%)</span>
                  </div>
                </div>
              )}

              {outputTab === 'SEO' && (
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-mono text-atlas-text-dim uppercase tracking-wider">Title Options (A/B test)</span>
                    <div className="space-y-1.5 mt-2">
                      {result.titles.map((title, i) => (
                        <div key={i} className="flex items-center justify-between bg-atlas-bg/60 rounded-lg px-4 py-2.5 border border-atlas-border/50 group">
                          <div className="flex items-center gap-2">
                            <Badge color={i === 0 ? '#22c55e' : '#94a3b8'}>{i === 0 ? 'Primary' : `Alt ${i}`}</Badge>
                            <span className="text-sm text-atlas-text-bright">{title}</span>
                          </div>
                          <button onClick={() => copyText(title, `title-${i}`)} className="opacity-0 group-hover:opacity-100 transition-opacity text-atlas-text-dim hover:text-atlas-accent">
                            {copied === `title-${i}` ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-atlas-text-dim uppercase tracking-wider">Description</span>
                      <button onClick={() => copyText(result.description, 'desc')} className="flex items-center gap-1 text-[10px] text-atlas-text-dim hover:text-atlas-accent transition-colors">
                        {copied === 'desc' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied === 'desc' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="mt-2 text-sm text-atlas-text whitespace-pre-wrap bg-atlas-bg/60 rounded-lg p-4 border border-atlas-border/50 font-sans">{result.description}</pre>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-mono text-atlas-text-dim uppercase tracking-wider">Hashtags</span>
                      <button onClick={() => copyText(result.hashtags.join(' '), 'hashtags')} className="flex items-center gap-1 text-[10px] text-atlas-text-dim hover:text-atlas-accent transition-colors">
                        {copied === 'hashtags' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied === 'hashtags' ? 'Copied' : 'Copy all'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.hashtags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-atlas-accent/8 text-atlas-accent text-xs font-mono border border-atlas-accent/15">
                          <Hash className="w-2.5 h-2.5" />{tag.replace('#', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {outputTab === 'Publishing' && (
                <div className="space-y-3">
                  <span className="text-[9px] font-mono text-atlas-text-dim uppercase tracking-wider">Publishing Notes & Recommendations</span>
                  <div className="space-y-2 mt-2">
                    {result.publishingNotes.map((note, i) => (
                      <div key={i} className="flex items-start gap-3 bg-atlas-bg/60 rounded-lg px-4 py-3 border border-atlas-border/50">
                        <span className="w-5 h-5 rounded-full bg-atlas-accent/12 text-atlas-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        <span className="text-sm text-atlas-text">{note}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Pipeline Cost', value: result.estimatedCost, color: '#f59e0b' },
                      { label: 'Duration', value: result.totalDuration, color: '#3b82f6' },
                      { label: 'Agents Used', value: '5', color: '#a855f7' },
                    ].map((m) => (
                      <div key={m.label} className="bg-atlas-surface2/50 rounded-lg p-3 text-center border border-atlas-border/50">
                        <div className="text-[9px] font-mono text-atlas-text-dim uppercase">{m.label}</div>
                        <div className="text-lg font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error state — backend not reachable */}
      {error && pipelineState === 'idle' && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-1">Pipeline Error</h3>
              <p className="text-sm text-atlas-text-dim mb-3">{error}</p>
              <div className="bg-atlas-bg/60 rounded-lg p-3 font-mono text-[11px] text-atlas-text-dim space-y-1 border border-atlas-border/50">
                <div><span className="text-atlas-accent">1.</span> cp .env.example .env</div>
                <div><span className="text-atlas-accent">2.</span> Add OPENAI_API_KEY=sk-... to .env</div>
                <div><span className="text-atlas-accent">3.</span> node server/index.js</div>
                <div><span className="text-atlas-accent">4.</span> Click Generate again</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Idle state */}
      {pipelineState === 'idle' && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/15 to-orange-500/15 border border-rose-500/20 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-atlas-text-bright mb-1">Ready to Produce</h3>
          <p className="text-sm text-atlas-text-dim max-w-md mb-2">
            Select a channel and click <span className="text-orange-400 font-semibold">Generate Shorts Package</span> to run the full production pipeline.
          </p>
          <p className="text-xs text-atlas-text-dim/60 font-mono">
            Topic → Script → Visuals → Thumbnail → SEO → Export
          </p>
          <div className="flex items-center gap-4 mt-6 text-[10px] font-mono text-atlas-text-dim">
            <span>5 real OpenAI calls</span>
            <span className="text-atlas-border">·</span>
            <span>gpt-4.1-mini</span>
            <span className="text-atlas-border">·</span>
            <span>~$0.003 total</span>
          </div>
        </div>
      )}
    </div>
  );
}
