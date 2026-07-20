import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, FolderOpen, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { Badge, EmptyState } from '../components/ui';
import { cn } from '../utils/cn';

const BACKEND = 'http://localhost:3001';

interface AssetFile {
  name: string;
  size: number;
  path: string;      // "2026-07-03_14-22-18/script.md"
  modified: string;
}

interface Production {
  folder: string;     // "2026-07-03_14-22-18"
  topic: string;
  created: string;
  files: AssetFile[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const FILE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  'script.md':          { label: 'Script',    color: '#a855f7' },
  'visual-prompts.md':  { label: 'Visuals',   color: '#06b6d4' },
  'thumbnail-brief.md': { label: 'Thumbnail', color: '#f97316' },
  'seo-package.md':     { label: 'SEO',       color: '#22c55e' },
  'final-package.json': { label: 'Package',   color: '#3b82f6' },
};

function downloadFile(path: string) {
  // Open in new tab — the backend sets Content-Disposition: attachment
  window.open(`${BACKEND}/api/assets/${path}/download`, '_blank');
}

function downloadFullPackage(folder: string) {
  // Hits the ZIP endpoint — backend sets Content-Type: application/zip
  window.open(`${BACKEND}/api/assets/${folder}/download-zip`, '_blank');
}

export default function AssetLibrary() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/assets`);
      if (!res.ok) throw new Error(`Failed to load assets (${res.status})`);
      const data = await res.json();
      setProductions(data.productions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
      setProductions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const totalFiles = productions.reduce((s, p) => s + p.files.length, 0);
  const totalBytes = productions.reduce((s, p) => s + p.files.reduce((fs, f) => fs + f.size, 0), 0);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-atlas-text-bright">Asset Library</h2>
          <p className="text-xs text-atlas-text-dim mt-0.5">
            {loading ? 'Loading…' : `${productions.length} productions · ${totalFiles} files · ${formatBytes(totalBytes)}`}
          </p>
        </div>
        <button
          onClick={loadAssets}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-atlas-surface2 border border-atlas-border text-xs text-atlas-text-dim hover:text-atlas-text transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && productions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-atlas-surface border border-atlas-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold font-mono text-atlas-accent">{productions.length}</div>
            <div className="text-[10px] font-mono text-atlas-text-dim uppercase">Productions</div>
          </div>
          <div className="bg-atlas-surface border border-atlas-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold font-mono text-emerald-400">{totalFiles}</div>
            <div className="text-[10px] font-mono text-atlas-text-dim uppercase">Files</div>
          </div>
          <div className="bg-atlas-surface border border-atlas-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold font-mono text-amber-400">{formatBytes(totalBytes)}</div>
            <div className="text-[10px] font-mono text-atlas-text-dim uppercase">Total Size</div>
          </div>
          <div className="bg-atlas-surface border border-atlas-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold font-mono text-purple-400">server/generated/</div>
            <div className="text-[10px] font-mono text-atlas-text-dim uppercase">Storage Path</div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-atlas-text-dim mt-1">Make sure the backend is running: <code className="font-mono text-atlas-text">node server/index.js</code></p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-atlas-text-dim animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && productions.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="No generated assets yet"
          sub="Run the Production Pipeline to generate your first Shorts package"
        />
      )}

      {/* Productions list */}
      {!loading && productions.length > 0 && (
        <div className="space-y-3">
          {productions.map((prod) => {
            const isExpanded = expandedFolder === prod.folder;
            return (
              <div key={prod.folder} className="bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden">
                {/* Production header */}
                <button
                  onClick={() => setExpandedFolder(isExpanded ? null : prod.folder)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-atlas-surface2/20 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-atlas-accent/10 border border-atlas-accent/20 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-4 h-4 text-atlas-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-atlas-text-bright truncate">{prod.topic}</div>
                    <div className="text-[10px] font-mono text-atlas-text-dim">
                      {prod.folder} · {prod.files.length} files · {formatBytes(prod.files.reduce((s, f) => s + f.size, 0))}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-atlas-text-dim shrink-0">{formatDate(prod.created)}</span>
                  <svg className={cn('w-4 h-4 text-atlas-text-dim transition-transform', isExpanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* File list */}
                {isExpanded && (
                  <div className="border-t border-atlas-border/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-mono text-atlas-text-dim uppercase border-b border-atlas-border/50">
                          <th className="text-left px-4 py-2 font-medium">File</th>
                          <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Type</th>
                          <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Size</th>
                          <th className="text-right px-4 py-2 font-medium">Download</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prod.files.map((file) => {
                          const typeInfo = FILE_TYPE_MAP[file.name] || { label: 'File', color: '#94a3b8' };
                          return (
                            <tr key={file.name} className="border-b border-atlas-border/30 hover:bg-atlas-surface2/20 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5 text-atlas-text-dim shrink-0" />
                                  <span className="font-mono text-xs text-atlas-text-bright">{file.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 hidden sm:table-cell">
                                <Badge color={typeInfo.color}>{typeInfo.label}</Badge>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-atlas-text-dim hidden md:table-cell">
                                {formatBytes(file.size)}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => downloadFile(file.path)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-atlas-text-dim hover:text-atlas-accent hover:bg-atlas-accent/8 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  Download
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Download all as JSON */}
                    <div className="px-4 py-2.5 border-t border-atlas-border/30 flex justify-end">
                      <button
                        onClick={() => downloadFullPackage(prod.folder)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-atlas-accent/10 text-atlas-accent text-xs font-medium hover:bg-atlas-accent/20 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Download Full Package
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
