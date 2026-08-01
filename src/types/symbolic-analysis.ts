// Symbolic Analysis — wire contract for POST /api/symbolic-analysis
// Technical layer ids (ebced, cifir, …) are never required in the UI payload.

export interface SymbolicAnalysisConsents {
  symbolicReading: boolean;
  dataProcessing: boolean;
}

export interface SymbolicAnalysisInput {
  name: string;
  birthDate: string;
  birthTime?: string | null;
  birthPlace?: string | null;
  intention?: string | null;
  fullName?: string | null;
  motherName?: string | null;
  /** Always null while photo infrastructure is absent. */
  photoRef?: string | null;
  consents: SymbolicAnalysisConsents;
}

export type SymbolicUserResultStatus =
  | 'roadmap'
  | 'partial'
  | 'complete'
  | 'insufficient_data';

export interface SymbolicUserSection {
  id: string;
  title: string;
  body: string;
}

export interface SymbolicMethodDisclosure {
  source: string;
  method: string;
  usedDataKeys: string[];
  limitations: string[];
  /** Faz 1–2 additive (when ATLAS_SYMBOLIC_METADATA_V2) */
  displayName?: string;
  disclaimer?: string;
  isClassicalAbjad?: boolean;
  methodologyId?: string;
  usedDataLabels?: string[];
  selectionPathLabel?: string;
  experimental?: boolean;
}

export interface SymbolicMethodologyPresentation {
  displayName: string;
  disclaimer: string;
  isClassicalAbjad: boolean;
  methodologyId?: string;
  comingSoon?: Array<{
    label: string;
    active: boolean;
    methodologyId?: string;
  }>;
}

export interface SymbolicMethodologyAssessment {
  transliterationCertainty: number | null;
  orthographicDisputeLevel: 'none' | 'low' | 'medium' | 'high' | 'not-applicable';
  matchStrength: number | null;
  interpretationLimitations: string[];
}

export interface SymbolicUserResult {
  title: string;
  status: SymbolicUserResultStatus;
  sections: SymbolicUserSection[];
  methodDisclosure?: SymbolicMethodDisclosure[];
  /** Always-visible methodology banner when metadata v2 is on */
  methodologyPresentation?: SymbolicMethodologyPresentation;
}

export interface SymbolicAnalysisResponse {
  version: string;
  ok: boolean;
  error: string | null;
  missingRequired: string[];
  userResult: SymbolicUserResult;
  metadata?: {
    llmUsed?: boolean;
    fabricated?: boolean;
    photoUpload?: boolean;
    symbolicMetadataV2?: boolean;
    symbolicMethodology?: {
      methodologyId: string;
      methodologyVersion: string;
      rulesetVersion: string;
      catalogVersion: null;
      generatedAt: string;
    };
    assessment?: SymbolicMethodologyAssessment;
    inputSnapshot?: {
      originalInput: string;
      selectedMethodologyId: string;
      intentionInput: string | null;
      locale: string;
    };
    reproducibilitySnapshot?: Record<string, unknown>;
    methodologyNotes?: string[];
    inputContract?: {
      required: string[];
      optional: string[];
      consentsRequired?: string[];
      photoUpload?: boolean;
    };
  };
}

export interface SymbolicAnalysisRequest {
  input: SymbolicAnalysisInput;
  layers?: string[];
  include_trace?: boolean;
}
