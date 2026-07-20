import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { agents, type AgentSpec } from "../data/agents";
import { cn } from "../utils/cn";

const agentEmojis: Record<string, string> = {
  "trend-researcher": "📈",
  "topic-discoverer": "💡",
  "competitor-analyst": "🎯",
  "script-writer": "✍️",
  "storyteller": "📖",
  "visual-prompter": "🎨",
  "thumbnail-creator": "🖼️",
  "seo-optimizer": "🔍",
  "metadata-manager": "🗄️",
  "publisher": "🚀",
  "analytics-tracker": "📊",
  "performance-optimizer": "⚡",
};

function AgentCard({ agent, isExpanded, onToggle }: { agent: AgentSpec; isExpanded: boolean; onToggle: () => void }) {
  const [activeTab, setActiveTab] = useState<"inputs" | "outputs" | "memory" | "tools" | "errors" | "kpis">("inputs");

  const tabs = [
    { key: "inputs" as const, label: "Inputs", count: agent.inputs.length },
    { key: "outputs" as const, label: "Outputs", count: agent.outputs.length },
    { key: "memory" as const, label: "Memory", count: agent.memory.length },
    { key: "tools" as const, label: "Tools", count: agent.tools.length },
    { key: "errors" as const, label: "Error Handling", count: agent.errorHandling.length },
    { key: "kpis" as const, label: "KPIs", count: agent.kpis.length },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn(
        "glass-card rounded-2xl overflow-hidden transition-all duration-300",
        isExpanded && "col-span-1 md:col-span-2 lg:col-span-3"
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-6 text-left flex items-start gap-4 hover:bg-atlas-surface2/30 transition-colors"
      >
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-2xl"
          style={{
            backgroundColor: `${agent.colorHex}12`,
            border: `1px solid ${agent.colorHex}30`,
          }}
        >
          {agentEmojis[agent.id] || "🤖"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-atlas-text-bright">{agent.name}</h3>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${agent.colorHex}15`,
                color: agent.colorHex,
                border: `1px solid ${agent.colorHex}30`,
              }}
            >
              Phase {agent.phase}
            </span>
          </div>
          <p className="text-sm text-atlas-text-dim mt-1">{agent.role}</p>
          {!isExpanded && (
            <p className="text-sm text-atlas-text-dim mt-2 line-clamp-2">{agent.description}</p>
          )}
        </div>
        <div className="shrink-0 mt-1">
          <motion.svg
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="w-5 h-5 text-atlas-text-dim"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">
              {/* Description */}
              <p className="text-sm text-atlas-text leading-relaxed mb-6 bg-atlas-surface2/50 rounded-xl p-4 border border-atlas-border/50">
                {agent.description}
              </p>

              {/* LLM Model */}
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-atlas-text-dim font-mono">LLM:</span>
                <span className="text-xs font-mono px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {agent.llmModel}
                </span>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1 mb-4 bg-atlas-surface2/50 rounded-lg p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      activeTab === tab.key
                        ? "bg-atlas-accent/20 text-atlas-accent"
                        : "text-atlas-text-dim hover:text-atlas-text hover:bg-atlas-surface"
                    )}
                  >
                    {tab.label}
                    <span className="ml-1 opacity-50">({tab.count})</span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="min-h-[200px]">
                {activeTab === "inputs" && (
                  <div className="space-y-2">
                    {agent.inputs.map((input, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-atlas-surface2/30">
                        <span className="text-green-400 mt-0.5 shrink-0">→</span>
                        <span className="text-sm text-atlas-text">{input}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "outputs" && (
                  <div className="space-y-2">
                    {agent.outputs.map((output, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-atlas-surface2/30">
                        <span className="text-blue-400 mt-0.5 shrink-0">←</span>
                        <span className="text-sm text-atlas-text">{output}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "memory" && (
                  <div className="space-y-3">
                    {agent.memory.map((mem, i) => (
                      <div key={i} className="p-3 rounded-xl bg-atlas-surface2/50 border border-atlas-border/50">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-mono font-bold text-purple-400">{mem.type}</span>
                        </div>
                        <p className="text-sm text-atlas-text-dim">{mem.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "tools" && (
                  <div className="flex flex-wrap gap-2">
                    {agent.tools.map((tool, i) => (
                      <span
                        key={i}
                        className="text-xs font-mono px-3 py-1.5 rounded-lg bg-atlas-surface2 text-atlas-text border border-atlas-border hover:border-atlas-accent/30 transition-colors"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                )}

                {activeTab === "errors" && (
                  <div className="space-y-2">
                    {agent.errorHandling.map((err, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-atlas-surface2/50 border border-atlas-border/50">
                        <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
                        <span className="text-sm text-atlas-text">{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "kpis" && (
                  <div className="space-y-2">
                    {agent.kpis.map((kpi, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-atlas-surface2/50 border border-atlas-border/50">
                        <span className="text-emerald-400 mt-0.5 shrink-0">📊</span>
                        <span className="text-sm text-atlas-text">{kpi}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Scalability */}
              <div className="mt-6 pt-4 border-t border-atlas-border/50">
                <h4 className="text-xs font-mono font-bold text-atlas-text-dim uppercase tracking-wider mb-3">
                  Scalability Strategy
                </h4>
                <div className="space-y-2">
                  {agent.scalability.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5 shrink-0 text-xs">◆</span>
                      <span className="text-sm text-atlas-text-dim">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AgentDetails() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section id="agents" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Agent <span className="gradient-text">Specifications</span>
          </h2>
          <p className="text-atlas-text-dim text-lg max-w-2xl mx-auto">
            Deep-dive into each agent's inputs, outputs, memory architecture,
            tools, error handling, and scalability strategy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isExpanded={expandedId === agent.id}
              onToggle={() => setExpandedId(expandedId === agent.id ? null : agent.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
