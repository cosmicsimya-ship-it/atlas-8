import { motion } from "framer-motion";
import { techStack } from "../data/agents";

const categoryColors: Record<string, string> = {
  "Orchestration": "#3b82f6",
  "Messaging": "#f97316",
  "Data Layer": "#a855f7",
  "AI/ML": "#ec4899",
  "Observability": "#22c55e",
  "API & Auth": "#06b6d4",
  "CI/CD": "#eab308",
  "Languages": "#6366f1",
};

const categoryIcons: Record<string, string> = {
  "Orchestration": "🏗️",
  "Messaging": "📨",
  "Data Layer": "💾",
  "AI/ML": "🧠",
  "Observability": "👁️",
  "API & Auth": "🔐",
  "CI/CD": "🔄",
  "Languages": "💻",
};

export default function TechStackSection() {
  return (
    <section id="tech-stack" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Technology <span className="gradient-text">Stack</span>
          </h2>
          <p className="text-atlas-text-dim text-lg max-w-2xl mx-auto">
            Production-grade infrastructure designed for reliability, observability,
            and horizontal scalability across all system layers.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(techStack).map(([category, items], index) => {
            const color = categoryColors[category] || "#94a3b8";
            const icon = categoryIcons[category] || "📦";

            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="glass-card rounded-2xl p-6 hover:border-opacity-40 transition-all group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{
                      backgroundColor: `${color}12`,
                      border: `1px solid ${color}25`,
                    }}
                  >
                    {icon}
                  </div>
                  <h3 className="font-bold text-atlas-text-bright">{category}</h3>
                </div>

                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-atlas-surface2/50 border border-atlas-border/30 hover:border-atlas-border/60 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-atlas-text font-mono">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
