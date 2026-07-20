import { motion } from "framer-motion";

const strategies = [
  {
    title: "Circuit Breaker Pattern",
    icon: "🔌",
    color: "#ef4444",
    description: "When an external API or downstream agent fails repeatedly, the circuit breaker trips to prevent cascade failures. Agents degrade gracefully to cached data or fallback models.",
    details: [
      "3-state machine: Closed → Open → Half-Open",
      "Configurable failure threshold (default: 5 failures in 60s)",
      "Automatic recovery attempt after cooldown period",
      "Health check endpoint per agent for monitoring",
    ],
  },
  {
    title: "Retry with Exponential Backoff",
    icon: "🔄",
    color: "#f59e0b",
    description: "Transient failures trigger automatic retries with increasing delays and jitter to prevent thundering herd problems across distributed agents.",
    details: [
      "Base delay: 1s, Max delay: 60s, Jitter: ±25%",
      "Max retry attempts: configurable per operation (default: 5)",
      "Dead letter queue for exhausted retries",
      "Retry metrics tracked per agent and operation type",
    ],
  },
  {
    title: "Graceful Degradation",
    icon: "📉",
    color: "#3b82f6",
    description: "When components are unavailable, agents automatically switch to degraded-but-functional modes using cached data, simpler models, or template-based generation.",
    details: [
      "Multi-tier fallback chain per agent",
      "Quality score tracking in degraded mode",
      "Automatic escalation to human review when quality drops below threshold",
      "Feature flags for manual degradation control",
    ],
  },
  {
    title: "Dead Letter Queue & Poison Pill Detection",
    icon: "☠️",
    color: "#a855f7",
    description: "Messages that cannot be processed after maximum retries are routed to dead letter queues for investigation, preventing pipeline blockage.",
    details: [
      "Separate DLQ per agent and message type",
      "Automatic alerting on DLQ depth thresholds",
      "Poison pill pattern detection and quarantine",
      "Manual replay capability with modification",
    ],
  },
  {
    title: "Idempotency & Exactly-Once Processing",
    icon: "🔑",
    color: "#22c55e",
    description: "All agent operations are idempotent with deduplication keys, ensuring safe retries and preventing duplicate video publications or metadata updates.",
    details: [
      "Unique operation ID per message/request",
      "Redis-based deduplication with configurable TTL",
      "Transactional outbox pattern for state + event consistency",
      "Idempotency key validation at API gateway level",
    ],
  },
  {
    title: "Observability & Alerting",
    icon: "🔔",
    color: "#06b6d4",
    description: "Comprehensive monitoring with distributed tracing, structured logging, and intelligent alerting to detect and respond to issues before they impact production.",
    details: [
      "OpenTelemetry-based distributed tracing (Jaeger)",
      "Structured JSON logging → ELK Stack",
      "Custom Grafana dashboards per agent",
      "PagerDuty integration with escalation policies",
      "SLA monitoring with automatic remediation triggers",
    ],
  },
];

export default function ErrorHandlingSection() {
  return (
    <section id="error-handling" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Error Handling & <span className="gradient-text">Resilience</span>
          </h2>
          <p className="text-atlas-text-dim text-lg max-w-2xl mx-auto">
            Production-grade fault tolerance with multiple layers of defense ensuring
            the pipeline continues operating even under partial system failures.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {strategies.map((strategy, index) => (
            <motion.div
              key={strategy.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="glass-card rounded-2xl p-6 group hover:border-opacity-50 transition-all"
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{
                    backgroundColor: `${strategy.color}12`,
                    border: `1px solid ${strategy.color}25`,
                  }}
                >
                  {strategy.icon}
                </div>
                <div>
                  <h3 className="font-bold text-atlas-text-bright text-lg leading-tight">
                    {strategy.title}
                  </h3>
                </div>
              </div>

              <p className="text-sm text-atlas-text-dim leading-relaxed mb-4">
                {strategy.description}
              </p>

              <div className="space-y-2 pt-4 border-t border-atlas-border/50">
                {strategy.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: strategy.color }} />
                    <span className="text-xs text-atlas-text-dim font-mono">{detail}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Error flow diagram */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 glass-card rounded-2xl p-8"
        >
          <h3 className="text-sm font-mono font-bold text-atlas-text-dim uppercase tracking-wider mb-6">
            Error Resolution Flow
          </h3>
          <div className="flex flex-col md:flex-row items-stretch gap-4">
            {[
              { label: "Error Detected", sub: "Agent catches exception", color: "#ef4444", icon: "⚡" },
              { label: "Classification", sub: "Transient vs Permanent", color: "#f59e0b", icon: "🔍" },
              { label: "Retry / Fallback", sub: "Exponential backoff or degrade", color: "#3b82f6", icon: "🔄" },
              { label: "Circuit Break", sub: "If retries exhausted", color: "#a855f7", icon: "🔌" },
              { label: "Dead Letter Queue", sub: "Park for investigation", color: "#ec4899", icon: "📬" },
              { label: "Alert & Escalate", sub: "PagerDuty → Human", color: "#06b6d4", icon: "🚨" },
            ].map((step, i) => (
              <div key={i} className="flex-1 flex items-center gap-3 md:flex-col md:items-stretch">
                <div
                  className="rounded-xl p-4 flex-1 text-center"
                  style={{
                    backgroundColor: `${step.color}08`,
                    border: `1px solid ${step.color}20`,
                  }}
                >
                  <div className="text-xl mb-2">{step.icon}</div>
                  <div className="text-sm font-semibold text-atlas-text-bright">{step.label}</div>
                  <div className="text-[10px] text-atlas-text-dim mt-1">{step.sub}</div>
                </div>
                {i < 5 && (
                  <div className="hidden md:flex items-center justify-center text-atlas-text-dim">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
