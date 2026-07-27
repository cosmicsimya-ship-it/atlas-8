// ═══════════════════════════════════════════════════════════════════════
// Personal Analysis — HTTP Contract Types
//
// Source of truth: POST /api/personal-analysis in server/index.js, and
// the core-engine Input/Output Contract in agents/core-engine.md.
//
// This file describes the wire contract only (what the frontend sends
// and receives over HTTP). It intentionally uses the exact snake_case
// field names used on the wire — the snake_case → camelCase translation
// inside the backend (task-router.js → runPersonalAnalysisPipeline) is
// an internal backend concern and is not represented here.
//
// Fully isolated from the Shorts production pipeline (see pipeline.ts).
// Nothing in this file is imported by, or imports from, the Shorts
// pipeline engine, AI provider, or generation flow.
// ═══════════════════════════════════════════════════════════════════════

// ── Request: POST /api/personal-analysis ───────────────────────────────

export interface PersonalAnalysisBirthData {
  date: string; // "YYYY-MM-DD"
  time: string | null; // "HH:MM" or null
  place: string | null;
}

export interface PersonalAnalysisLifeEvent {
  period: string; // e.g. "2019-2021"
  description: string;
}

export interface PersonalAnalysisSubjectProfile {
  birth_data: PersonalAnalysisBirthData;
  life_events: PersonalAnalysisLifeEvent[];
  user_notes?: string;
}

export type PersonalAnalysisSourceSystem =
  | 'astrological'
  | 'numerological'
  | 'fate_matrix'
  | 'ebced';

export interface PersonalAnalysisFinding {
  id: string;
  theme: string;
  claim: string;
  evidence_refs: string[];
}

export interface PersonalAnalysisSystemInput {
  system: PersonalAnalysisSourceSystem;
  findings: PersonalAnalysisFinding[];
}

export interface PersonalAnalysisInputs {
  astrological?: PersonalAnalysisSystemInput;
  numerological?: PersonalAnalysisSystemInput;
  fate_matrix?: PersonalAnalysisSystemInput;
  ebced?: PersonalAnalysisSystemInput | null;
}

export interface PersonalAnalysisRequest {
  task_id: string;
  subject_id: string;
  subject_profile: PersonalAnalysisSubjectProfile;
  analysis_inputs?: PersonalAnalysisInputs;
  constraints?: string[];
}

// ── Response: 200 — core-engine envelope ────────────────────────────────
// Returned as-is by the route for BOTH "complete" and non-"complete"
// business outcomes ("insufficient_data" | "reject"). A non-"complete"
// status is not an HTTP error.

export type PersonalAnalysisStatus = 'complete' | 'insufficient_data' | 'reject';

export type PersonalAnalysisConfidenceLevel = 'high' | 'medium' | 'low';

export type PersonalAnalysisContradictionResolution =
  | 'held_separate'
  | 'partial_overlap'
  | 'unresolved';

export interface PersonalAnalysisSourceFinding {
  id: string;
  system: string;
  theme: string;
  claim: string;
}

export interface PersonalAnalysisConvergence {
  theme: string;
  summary: string;
  supported_by: string[]; // finding ids
  systems: string[];
  confidence: PersonalAnalysisConfidenceLevel;
}

export interface PersonalAnalysisContradictionPosition {
  system: string;
  claim: string;
}

export interface PersonalAnalysisContradiction {
  topic: string;
  systems: string[];
  positions: PersonalAnalysisContradictionPosition[];
  resolution: PersonalAnalysisContradictionResolution;
}

export interface PersonalAnalysisConfidenceByFinding {
  finding_id: string;
  score: number; // 0.0–1.0
  reason: string;
}

export interface PersonalAnalysisConfidence {
  overall: number; // 0.0–1.0
  by_finding: PersonalAnalysisConfidenceByFinding[];
}

export interface PersonalAnalysisEvidenceMapEntry {
  synthesis_claim: string;
  finding_ids: string[];
  supported_by: string[];
  strength: PersonalAnalysisConfidenceLevel;
}

export interface PersonalAnalysisSynthesis {
  subject_id: string;
  source_systems: string[];
  source_findings: PersonalAnalysisSourceFinding[];
  convergences: PersonalAnalysisConvergence[];
  contradictions: PersonalAnalysisContradiction[];
  core_pattern: string;
  life_architecture: string;
  development_axis: string;
  current_cycle: string;
  potential_gates: string[];
  recommended_directions: string[];
  confidence: PersonalAnalysisConfidence;
  evidence_map: PersonalAnalysisEvidenceMapEntry[];
  missing_data: string[];
  warnings: string[];
}

export interface PersonalAnalysisEnvelope {
  agent: 'core-engine';
  task_id: string;
  status: PersonalAnalysisStatus;
  payload: {
    synthesis: PersonalAnalysisSynthesis;
  };
  handoff_to: string[];
}

// ── Response: error bodies ──────────────────────────────────────────────

export interface PersonalAnalysisValidationError {
  error: string;
}

export interface PersonalAnalysisGatewayError {
  error: string;
  stoppedAt: string | null;
  detail: unknown;
}

export interface PersonalAnalysisServerError {
  error: string;
}

export type PersonalAnalysisErrorResponse =
  | PersonalAnalysisValidationError
  | PersonalAnalysisGatewayError
  | PersonalAnalysisServerError;

// ── Combined response type ──────────────────────────────────────────────

export type PersonalAnalysisResponse =
  | PersonalAnalysisEnvelope
  | PersonalAnalysisErrorResponse;
