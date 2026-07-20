import { useState } from "react";
import { motion } from "framer-motion";
import { agents } from "../data/agents";
import { cn } from "../utils/cn";

const phaseColors: Record<number, string> = {
  1: "#3b82f6",
  2: "#a855f7",
  3: "#06b6d4",
  4: "#22c55e",
  5: "#f59e0b",
};

const phaseNames: Record<number, string> = {
  1: "Research & Discovery",
  2: "Content Production",
  3: "Visual Production",
  4: "Optimization & Publishing",
  5: "Analysis & Optimization",
};

const phaseAgents: Record<number, typeof agents> = {};
agents.forEach((a) => {
  if (!phaseAgents[a.phase]) phaseAgents[a.phase] = [];
  phaseAgents[a.phase].push(a);
});

export default function ArchitectureDiagram() {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  return (
    <section id="architecture" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            System <span className="gradient-text">Architecture</span>
          </h2>
          <p className="text-atlas-text-dim text-lg max-w-2xl mx-auto">
            Five-phase pipeline architecture with event-driven inter-agent communication,
            shared memory layers, and continuous feedback loops.
          </p>
        </motion.div>

        {/* Pipeline Flow Diagram */}
        <div className="relative">
          {/* Connection lines between phases */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-amber-500/20 -translate-y-1/2 z-0" />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 relative z-10">
            {[1, 2, 3, 4, 5].map((phase) => (
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: phase * 0.1 }}
                className="relative"
              >
                {/* Phase header */}
                <div className="text-center mb-4">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold mb-2"
                    style={{
                      backgroundColor: `${phaseColors[phase]}15`,
                      color: phaseColors[phase],
                      border: `1px solid ${phaseColors[phase]}30`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: phaseColors[phase] }}
                    />
                    Phase {phase}
                  </div>
                  <h3 className="text-sm font-semibold text-atlas-text-bright">
                    {phaseNames[phase]}
                  </h3>
                </div>

                {/* Agent cards in phase */}
                <div className="space-y-3">
                  {(phaseAgents[phase] || []).map((agent) => (
                    <motion.div
                      key={agent.id}
                      onMouseEnter={() => setHoveredAgent(agent.id)}
                      onMouseLeave={() => setHoveredAgent(null)}
                      whileHover={{ scale: 1.03 }}
                      className={cn(
                        "glass-card rounded-xl p-4 cursor-pointer transition-all duration-300",
                        hoveredAgent === agent.id && "ring-1"
                      )}
                      style={{
                        borderColor: hoveredAgent === agent.id ? agent.colorHex : undefined,
                        boxShadow: hoveredAgent === agent.id ? `0 0 20px ${agent.colorHex}20` : undefined,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg"
                          style={{
                            backgroundColor: `${agent.colorHex}15`,
                            border: `1px solid ${agent.colorHex}30`,
                          }}
                        >
                          {getAgentEmoji(agent.id)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-atlas-text-bright truncate">
                            {agent.name}
                          </h4>
                          <p className="text-xs text-atlas-text-dim mt-0.5">{agent.role}</p>
                        </div>
                      </div>

                      {hoveredAgent === agent.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 pt-3 border-t border-atlas-border"
                        >
                          <p className="text-xs text-atlas-text-dim leading-relaxed line-clamp-3">
                            {agent.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-atlas-surface2 text-atlas-text-dim">
                              {agent.inputs.length} inputs
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-atlas-surface2 text-atlas-text-dim">
                              {agent.outputs.length} outputs
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Arrow to next phase */}
                {phase < 5 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${phaseColors[phase]}20`, border: `1px solid ${phaseColors[phase]}40` }}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={phaseColors[phase]}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Feedback loop arrow */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex justify-center"
          >
            <div className="glass-card rounded-xl px-6 py-3 flex items-center gap-4">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm text-atlas-text-dim">
                <span className="text-amber-400 font-semibold">Continuous Feedback Loop</span> — Performance Optimizer feeds learning signals back to all upstream agents
              </span>
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Shared Infrastructure */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 glass-card rounded-2xl p-6"
        >
          <h3 className="text-sm font-mono font-bold text-atlas-text-dim uppercase tracking-wider mb-4">
            Shared Infrastructure Layer
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { name: "Kafka", desc: "Event Bus", color: "#3b82f6" },
              { name: "Redis", desc: "Cache / State", color: "#ef4444" },
              { name: "PostgreSQL", desc: "Persistent Store", color: "#3b82f6" },
              { name: "Pinecone", desc: "Vector Memory", color: "#8b5cf6" },
              { name: "Neo4j", desc: "Graph DB", color: "#22c55e" },
              { name: "Kong", desc: "API Gateway", color: "#06b6d4" },
              { name: "K8s", desc: "Orchestration", color: "#3b82f6" },
            ].map((infra) => (
              <div
                key={infra.name}
                className="rounded-lg p-3 text-center"
                style={{
                  backgroundColor: `${infra.color}08`,
                  border: `1px solid ${infra.color}20`,
                }}
              >
                <div className="text-sm font-semibold text-atlas-text-bright">{infra.name}</div>
                <div className="text-[10px] text-atlas-text-dim mt-0.5">{infra.desc}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function getAgentEmoji(id: string): string {
  const map: Record<string, string> = {
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
  return map[id] || "🤖";
}
