# RFC-008 — Safety, Audit & Trace

**Status:** Normative  
**Parent:** [ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md](../ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md)  
**Document id:** `atlas-rfc-008-safety-audit-trace-v1`  
**Last updated:** 2026-07-31  
**Implementation status:** Spec only  
**Aligns with:** ARCHITECTURE_OPERATIONAL_APPENDIX, existing `safety.js`, cross-layer certainty filters

---

## 1. Purpose

Platform genelinde **Safety**, **Audit** ve **Trace** katmanlarının sorumluluklarını, veri sözleşmelerini ve “hesabı değiştirmez / belirsizliği gizlemez” kurallarını tanımlar.

---

## 2. Scope

- Platform safety rule catalog
- Safety vs calculation boundary
- Trace schema requirements
- Audit event schema (PII-minimized)
- Interaction with Snapshot Layer
- UI projection constraints for unsafe prose

---

## 3. Out of Scope

- Full SIEM product selection
- Payment authorization (see Operational Appendix; referenced only)
- Quran verse validation (owned by cross-layer quran-safety; synthesis MUST NOT invent verses)

---

## 4. Definitions

| Term | Meaning |
|------|---------|
| **Safety hit** | Matched forbidden certainty/harm pattern |
| **Trace** | Execution forensic for debugging/reproducibility support |
| **Audit** | Compliance/accountability event stream |
| **Calculated field** | Deterministic numeric/structured output in evidence/extension |
| **Interpreted field** | Prose, themes, reflective suggestions |

---

## 5. Normative Rules — Safety

1. No prophecy or certain-future claims.  
2. Not a substitute for medical, psychological, legal, or financial decisions.  
3. No religious certainty or mandatory practice claims.  
4. No fabricated personal identity or biography.  
5. Missing data MUST NOT be invented.  
6. Sensitive information not provided by the user MUST NOT be generated.  
7. Calculation and interpretation MUST remain separated in EngineResult.  
8. Uncertainty MUST NOT be hidden (limitations/warnings/assessment/confidence).  
9. Safety Layer **MUST NOT** alter calculated numbers, token lists, match ids, or evidence payloads’ factual calc fields.  
10. Safety Layer **MAY** sanitize or replace interpreted prose; on irrecoverable hits, substitute safe boilerplate (parity with `sanitizeSymbolicProse`).  
11. Esma suggestions are reflective names — MUST NOT be framed as treatment or divine command (existing esma-runner cautions preserved as platform rules).

---

## 6. Normative Rules — Trace

1. Default client responses **MUST NOT** include full trace unless explicitly requested (`include_trace` or future equivalent).  
2. Trace **MUST** record engine order, per-engine status, timings, skip/fail codes, dependency waits.  
3. Trace **MAY** include normalized non-PII summaries; raw photos/documents **MUST NOT** be inlined.  
4. Trace retention follows privacy policy; PII redaction hooks required.

---

## 7. Normative Rules — Audit

1. Audit events **MUST** include: `runId`, `executionId`, `engineId`, `methodologyId`, versions, flag snapshot, timestamp, actor type (user/admin/system).  
2. Audit payloads **MUST NOT** include full names by default (Operational Appendix: PII MUST NOT enter default analytics).  
3. Consent grant/deny events **MUST** be auditable.  
4. Admin methodology override events **MUST** be auditable.  
5. Audit **MUST NOT** be a substitute for immutable reproducibility snapshots.

---

## 8. Architecture

### 8.1 Current

| Module | Role |
|--------|------|
| `server/symbolic-analysis/safety.js` | Regex certainty scan + sanitize on section bodies |
| Orchestrator metadata | `llmUsed`, `fabricated` |
| Trace object | Always built server-side; stripped unless `include_trace` |
| Audit | No first-class symbolic audit stream yet |
| `cross-layer-synthesis/certainty-filter.js` & `safety.js` | Adjacent patterns to reuse |

### 8.2 Target modules

```
server/symbolic-platform/layers/safety/
  rules.ts
  scan.ts
  sanitize.ts
server/symbolic-platform/layers/trace/
  capture.ts
  redact.ts
server/symbolic-platform/layers/audit/
  events.ts
  emit.ts
```

---

## 9. Data Model

```ts
type SafetyRuleId =
  | 'no_prophecy'
  | 'no_medical_legal_financial'
  | 'no_religious_certainty'
  | 'no_fabricated_identity'
  | 'no_invented_data'
  | 'no_unguarded_sensitive_inference'
  | 'calc_interp_separation'
  | 'surface_uncertainty';

type SafetyHit = {
  ruleId: SafetyRuleId | string;
  engineId?: string;
  fieldPath: string; // e.g. result.sections[0].body
  match?: string;
  action: 'sanitize' | 'replace' | 'reject-section' | 'flag-only';
};

type SafetyReport = {
  ok: boolean;
  hits: SafetyHit[];
};

type TraceEngineFragment = {
  engineId: string;
  status: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  errorCode?: string | null;
  dependencyWaitMs?: number;
  capability?: { eligible: boolean; missing: string[]; readiness: string };
};

type RunTrace = {
  schemaVersion: 'atlas-trace-v1';
  runId: string;
  engineOrder: string[];
  engines: Record<string, TraceEngineFragment>;
  flags: Record<string, boolean>;
  synthesisIncluded: boolean;
};

type AuditEventType =
  | 'symbolic.run.started'
  | 'symbolic.run.completed'
  | 'symbolic.engine.finished'
  | 'symbolic.consent.resolved'
  | 'symbolic.safety.hit'
  | 'symbolic.methodology.override'
  | 'symbolic.flag.evaluated'
  | 'symbolic.snapshot.written';

type AuditEvent = {
  schemaVersion: 'atlas-audit-v1';
  type: AuditEventType;
  at: string;
  runId: string;
  executionId?: string;
  engineId?: string;
  methodologyId?: string;
  methodologyVersion?: string;
  engineVersion?: string;
  actor: { type: 'user' | 'admin' | 'system'; accountIdHash?: string };
  flags?: Record<string, boolean>;
  details?: Record<string, unknown>; // PII-minimized
};
```

---

## 10. Safety processing pipeline

```
Engine produces EngineResult
  → Safety scan interpreted fields only
  → sanitize/replace as needed
  → attach SafetyReport into audit + optional trace
  → calculated extension fields pass through untouched
  → UI Projection consumes safe prose
```

**Forbidden:** recalculating totals to “look safer”; dropping limitations to look more confident.

---

## 11. Warning & Limitation Contract (platform)

```ts
type WarningItem = {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
};

// Standard codes (non-exhaustive)
// MISSING_OPTIONAL_INPUT, ENGINE_PLANNED, ENGINE_TIMEOUT,
// UNSUPPORTED_CHARACTERS, EXPERIMENTAL_METHOD, SAFETY_SANITIZED,
// LOW_CROSS_ENGINE_AGREEMENT, CONSENT_REQUIRED (run-level)
```

Limitations array remains human-readable strings; engines SHOULD also emit stable codes in warnings for i18n.

---

## 12. API Impact

- `include_trace` continues to gate trace.
- Future: `include_audit` admin-only.
- Safety failures do not necessarily flip `ok: false` if sanitized successfully; irrecoverable run policy left to Orchestrator (prefer partial with warnings).

---

## 13. UI Impact

- Surface warnings/limitations/method disclosure always accessible.  
- Do not show raw safety regex matches to end users.  
- “Yöntemi gör” includes uncertainty areas.  

---

## 14. Method Disclosure

Safety rules 1–8 summarized in platform boilerplate appended to method sections when relevant; engines add specific limitations.

---

## 15. Examples

```ts
// Calculation untouched
extension.latinMotif.totalSum === 193; // before safety
// after safety on prose only
result.summary = sanitize(result.summary);
extension.latinMotif.totalSum === 193; // unchanged
```

---

## 16. Migration Impact

- Wrap `scanSymbolicCertainty` / `sanitizeSymbolicProse` as initial Safety Layer implementation.  
- Expand rule ids beyond Turkish regex list while keeping existing patterns.  
- Introduce audit emit alongside orchestrator without blocking legacy path.  
- Trace shape evolves under schemaVersion; adapter maps to legacy `trace` object.

---

## 17. Test Criteria

| Suite | Assert |
|-------|--------|
| safety.calc_immutable | Totals identical pre/post safety |
| safety.forbidden_phrases | Known bad strings sanitized |
| safety.no_fabricate | Incomplete input paths |
| trace.default_omitted | Client payload without flag lacks trace |
| audit.no_raw_name | Default audit details exclude name fields |
| uncertainty.visible | Limitations present when ambiguity high |

---

## 18. Acceptance Criteria

- [ ] Eight platform safety rules normative + calc immutability  
- [ ] Trace opt-in rule  
- [ ] Audit PII minimization  
- [ ] Schemas defined  
- [ ] Relation to current `safety.js` and Operational Appendix explicit  

---

## 19. Rejected Alternatives

| Rejected | Why |
|----------|-----|
| Safety mutates calculations | Breaks reproducibility & trust |
| Always return full trace to clients | Privacy & payload risk |
| Audit contains raw PII “for convenience” | Violates Operational Appendix |
| Hide limitations to reduce UX friction | Violates uncertainty rule |
