import { motion } from "framer-motion";
import { roadmap } from "../data/agents";
import { cn } from "../utils/cn";

const statusConfig = {
  completed: { label: "Completed", color: "#22c55e", bg: "#22c55e15", icon: "✓" },
  "in-progress": { label: "In Progress", color: "#3b82f6", bg: "#3b82f615", icon: "◉" },
  planned: { label: "Planned", color: "#f59e0b", bg: "#f59e0b15", icon: "○" },
  future: { label: "Future", color: "#94a3b8", bg: "#94a3b815", icon: "◌" },
};

export default function RoadmapSection() {
  return (
    <section id="roadmap" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Implementation <span className="gradient-text">Roadmap</span>
          </h2>
          <p className="text-atlas-text-dim text-lg max-w-2xl mx-auto">
            32-week phased rollout with incremental capability delivery,
            integration testing at each phase boundary, and staged production deployment.
          </p>
        </motion.div>

        {/* Status legend */}
        <div className="flex flex-wrap gap-4 justify-center mb-12">
          {Object.entries(statusConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm text-atlas-text-dim">{config.label}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="hidden md:block absolute left-[calc(50%-1px)] top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500/30 via-blue-500/30 to-gray-500/30" />

          <div className="space-y-8">
            {roadmap.map((item, index) => {
              const config = statusConfig[item.status];
              const isLeft = index % 2 === 0;

              return (
                <motion.div
                  key={item.phase}
                  initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "relative md:flex items-center",
                    isLeft ? "md:flex-row" : "md:flex-row-reverse"
                  )}
                >
                  {/* Content */}
                  <div className={cn("md:w-[calc(50%-2rem)]", isLeft ? "md:text-right" : "md:text-left")}>
                    <div
                      className="glass-card rounded-2xl p-6 inline-block w-full transition-all hover:shadow-lg"
                      style={{
                        borderColor: `${config.color}20`,
                      }}
                    >
                      {/* Header */}
                      <div className={cn("flex items-center gap-3 mb-3", isLeft ? "md:flex-row-reverse" : "")}>
                        <span
                          className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                          style={{ backgroundColor: config.bg, color: config.color }}
                        >
                          {item.phase}
                        </span>
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.color}30` }}
                        >
                          {config.label}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-atlas-text-bright mb-1">{item.title}</h3>
                      <p className="text-xs font-mono text-atlas-text-dim mb-4">{item.duration}</p>

                      {/* Items */}
                      <div className={cn("space-y-2", isLeft ? "md:text-right" : "")}>
                        {item.items.map((task, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-start gap-2 text-sm text-atlas-text-dim",
                              isLeft ? "md:flex-row-reverse" : ""
                            )}
                          >
                            <span className="mt-1 shrink-0" style={{ color: config.color }}>
                              {item.status === "completed" ? "✓" : "›"}
                            </span>
                            <span className={cn(item.status === "completed" && "line-through opacity-60")}>
                              {task}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Timeline node */}
                  <div className="hidden md:flex w-16 justify-center shrink-0">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2",
                        item.status === "in-progress" && "animate-pulse"
                      )}
                      style={{
                        borderColor: config.color,
                        backgroundColor: item.status === "completed" ? config.color : "transparent",
                      }}
                    />
                  </div>

                  {/* Spacer for the other side */}
                  <div className="hidden md:block md:w-[calc(50%-2rem)]" />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Summary metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { value: "32", unit: "weeks", label: "Total Duration", color: "#3b82f6" },
            { value: "6", unit: "phases", label: "Rollout Stages", color: "#a855f7" },
            { value: "42", unit: "tasks", label: "Deliverables", color: "#22c55e" },
            { value: "12", unit: "agents", label: "Full Deployment", color: "#f59e0b" },
          ].map((metric, i) => (
            <div key={i} className="glass-card rounded-xl p-6 text-center">
              <div className="text-3xl font-bold" style={{ color: metric.color }}>
                {metric.value}
              </div>
              <div className="text-xs text-atlas-text-dim font-mono">{metric.unit}</div>
              <div className="text-sm text-atlas-text-bright mt-1">{metric.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
