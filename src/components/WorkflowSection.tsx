import { useState } from "react";
import { motion } from "framer-motion";
import { workflowSteps, agents } from "../data/agents";
import { cn } from "../utils/cn";

const phaseColors = ["#3b82f6", "#a855f7", "#06b6d4", "#22c55e", "#f59e0b"];

export default function WorkflowSection() {
  const [activePhase, setActivePhase] = useState(0);

  return (
    <section id="workflow" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Production <span className="gradient-text">Workflow</span>
          </h2>
          <p className="text-atlas-text-dim text-lg max-w-2xl mx-auto">
            End-to-end video production pipeline from trend detection to
            performance optimization, with parallel execution and quality gates.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="hidden md:block absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/30 via-purple-500/30 to-amber-500/30" />

          <div className="space-y-8">
            {workflowSteps.map((step, index) => {
              const color = phaseColors[index];
              const stepAgents = step.agents.map((id) => agents.find((a) => a.id === id)!).filter(Boolean);
              const isActive = activePhase === index;

              return (
                <motion.div
                  key={step.phase}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative md:pl-20"
                >
                  {/* Timeline node */}
                  <div className="hidden md:flex absolute left-0 top-6 w-16 items-center justify-center">
                    <button
                      onClick={() => setActivePhase(isActive ? -1 : index)}
                      className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer"
                      style={{
                        backgroundColor: `${color}15`,
                        border: `2px solid ${isActive ? color : `${color}30`}`,
                        boxShadow: isActive ? `0 0 20px ${color}30` : "none",
                      }}
                    >
                      <span className="text-xs font-mono font-bold" style={{ color }}>
                        P{step.phase}
                      </span>
                    </button>
                  </div>

                  {/* Content card */}
                  <div
                    className={cn(
                      "glass-card rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer",
                      isActive && "ring-1"
                    )}
                    style={{
                      borderColor: isActive ? `${color}40` : undefined,
                      boxShadow: isActive ? `0 0 0 1px ${color}40` : undefined,
                    }}
                    onClick={() => setActivePhase(isActive ? -1 : index)}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className="md:hidden text-xs font-mono font-bold px-2 py-0.5 rounded"
                              style={{ backgroundColor: `${color}15`, color }}
                            >
                              Phase {step.phase}
                            </span>
                            <h3 className="text-xl font-bold text-atlas-text-bright">{step.name}</h3>
                          </div>
                          <p className="text-sm text-atlas-text-dim">{step.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-mono text-atlas-text-dim">{step.duration}</div>
                          <div
                            className="text-xs font-mono mt-1 px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: step.parallel ? "#22c55e15" : "#f59e0b15",
                              color: step.parallel ? "#22c55e" : "#f59e0b",
                            }}
                          >
                            {step.parallel ? "⚡ Parallel" : "→ Sequential"}
                          </div>
                        </div>
                      </div>

                      {/* Agent chips */}
                      <div className="flex flex-wrap gap-2">
                        {stepAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                            style={{
                              backgroundColor: `${agent.colorHex}10`,
                              border: `1px solid ${agent.colorHex}20`,
                            }}
                          >
                            <span className="text-xs">{getEmoji(agent.id)}</span>
                            <span className="text-atlas-text-bright text-xs font-medium">{agent.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isActive && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="border-t border-atlas-border/50"
                      >
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {stepAgents.map((agent) => (
                            <div
                              key={agent.id}
                              className="rounded-xl p-4"
                              style={{
                                backgroundColor: `${agent.colorHex}05`,
                                border: `1px solid ${agent.colorHex}15`,
                              }}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <span>{getEmoji(agent.id)}</span>
                                <span className="font-semibold text-sm text-atlas-text-bright">{agent.name}</span>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-[10px] font-mono text-green-400 uppercase">Key Inputs</span>
                                  <ul className="mt-1 space-y-0.5">
                                    {agent.inputs.slice(0, 3).map((inp, i) => (
                                      <li key={i} className="text-xs text-atlas-text-dim flex items-start gap-1.5">
                                        <span className="text-green-400 shrink-0 mt-0.5">›</span>
                                        <span className="line-clamp-1">{inp}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <span className="text-[10px] font-mono text-blue-400 uppercase">Key Outputs</span>
                                  <ul className="mt-1 space-y-0.5">
                                    {agent.outputs.slice(0, 3).map((out, i) => (
                                      <li key={i} className="text-xs text-atlas-text-dim flex items-start gap-1.5">
                                        <span className="text-blue-400 shrink-0 mt-0.5">›</span>
                                        <span className="line-clamp-1">{out}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function getEmoji(id: string): string {
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
