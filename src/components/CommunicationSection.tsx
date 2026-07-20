import { useState } from "react";
import { motion } from "framer-motion";
import { agents, communicationLinks } from "../data/agents";
import { cn } from "../utils/cn";

const protocolColors: Record<string, string> = {
  "Kafka Event Stream": "#3b82f6",
  "REST API + Message Queue": "#22c55e",
  "gRPC (low latency)": "#a855f7",
  "Message Queue (RabbitMQ)": "#f97316",
  "REST API": "#06b6d4",
};

function getProtocolColor(protocol: string): string {
  return protocolColors[protocol] || "#94a3b8";
}

export default function CommunicationSection() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);

  const filteredLinks = communicationLinks.filter((link) => {
    if (selectedAgent && link.from !== selectedAgent && link.to !== selectedAgent) return false;
    if (selectedProtocol && link.protocol !== selectedProtocol) return false;
    return true;
  });

  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const protocols = [...new Set(communicationLinks.map((l) => l.protocol))];

  return (
    <section id="communication" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Inter-Agent <span className="gradient-text">Communication</span>
          </h2>
          <p className="text-atlas-text-dim text-lg max-w-2xl mx-auto">
            Event-driven messaging architecture with protocol-specific channels
            optimized for latency, throughput, and reliability requirements.
          </p>
        </motion.div>

        {/* Protocol Legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap gap-2 justify-center mb-8"
        >
          <button
            onClick={() => setSelectedProtocol(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-mono transition-all border",
              !selectedProtocol
                ? "bg-white/10 text-white border-white/30"
                : "bg-transparent text-atlas-text-dim border-atlas-border hover:border-atlas-text-dim"
            )}
          >
            All Protocols
          </button>
          {protocols.map((protocol) => {
            const color = getProtocolColor(protocol);
            const isActive = selectedProtocol === protocol;
            return (
              <button
                key={protocol}
                onClick={() => setSelectedProtocol(isActive ? null : protocol)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-mono transition-all border"
                )}
                style={{
                  backgroundColor: isActive ? `${color}20` : "transparent",
                  color: isActive ? color : undefined,
                  borderColor: isActive ? `${color}50` : undefined,
                }}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />
                {protocol}
              </button>
            );
          })}
        </motion.div>

        {/* Agent filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap gap-2 justify-center mb-12"
        >
          <button
            onClick={() => setSelectedAgent(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              !selectedAgent
                ? "bg-atlas-accent/20 text-atlas-accent border-atlas-accent/30"
                : "bg-transparent text-atlas-text-dim border-atlas-border hover:border-atlas-text-dim"
            )}
          >
            All Agents
          </button>
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
              )}
              style={{
                backgroundColor: selectedAgent === agent.id ? `${agent.colorHex}20` : "transparent",
                color: selectedAgent === agent.id ? agent.colorHex : undefined,
                borderColor: selectedAgent === agent.id ? `${agent.colorHex}40` : undefined,
              }}
            >
              {agent.name}
            </button>
          ))}
        </motion.div>

        {/* Communication Matrix */}
        <div className="space-y-3">
          {filteredLinks.map((link, i) => {
            const fromAgent = agentMap.get(link.from);
            const toAgent = agentMap.get(link.to);
            const color = getProtocolColor(link.protocol);

            return (
              <motion.div
                key={`${link.from}-${link.to}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className="glass-card rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
              >
                {/* From Agent */}
                <div className="flex items-center gap-2 min-w-[160px]">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{
                      backgroundColor: `${fromAgent?.colorHex}15`,
                      border: `1px solid ${fromAgent?.colorHex}30`,
                    }}
                  >
                    {getEmoji(link.from)}
                  </div>
                  <span className="text-sm font-medium text-atlas-text-bright truncate">
                    {fromAgent?.name}
                  </span>
                </div>

                {/* Arrow + Protocol */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="hidden sm:block w-8 h-px" style={{ backgroundColor: `${color}40` }} />
                  <div
                    className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono shrink-0"
                    style={{
                      backgroundColor: `${color}10`,
                      color: color,
                      border: `1px solid ${color}25`,
                    }}
                  >
                    <span>→</span>
                    <span>{link.protocol}</span>
                  </div>
                  <div className="hidden sm:block w-8 h-px" style={{ backgroundColor: `${color}40` }} />
                </div>

                {/* To Agent */}
                <div className="flex items-center gap-2 min-w-[160px]">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{
                      backgroundColor: `${toAgent?.colorHex}15`,
                      border: `1px solid ${toAgent?.colorHex}30`,
                    }}
                  >
                    {getEmoji(link.to)}
                  </div>
                  <span className="text-sm font-medium text-atlas-text-bright truncate">
                    {toAgent?.name}
                  </span>
                </div>

                {/* Data type + frequency */}
                <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-atlas-surface2 text-atlas-text-dim">
                    {link.dataType}
                  </span>
                  <span className="text-[10px] text-atlas-text-dim">
                    {link.frequency}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredLinks.length === 0 && (
          <div className="text-center py-12 text-atlas-text-dim">
            No communication links match the current filters.
          </div>
        )}

        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            {
              label: "Total Data Flows",
              value: communicationLinks.length.toString(),
              sub: "Active communication channels",
              color: "#3b82f6",
            },
            {
              label: "Communication Protocols",
              value: protocols.length.toString(),
              sub: "Kafka, gRPC, REST, RabbitMQ",
              color: "#a855f7",
            },
            {
              label: "Real-time Streams",
              value: communicationLinks.filter((l) => l.frequency === "Real-time").length.toString(),
              sub: "Sub-second latency channels",
              color: "#22c55e",
            },
          ].map((stat, i) => (
            <div key={i} className="glass-card rounded-xl p-6 text-center">
              <div className="text-3xl font-bold mb-1" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-sm font-medium text-atlas-text-bright">{stat.label}</div>
              <div className="text-xs text-atlas-text-dim mt-1">{stat.sub}</div>
            </div>
          ))}
        </motion.div>
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
