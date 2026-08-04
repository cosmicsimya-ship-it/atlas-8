import type {
  PersonalAnalysisEnvelope,
  PersonalAnalysisRequest,
} from '../types/personal-analysis';
import { apiRequest } from './api-client';

export async function submitPersonalAnalysis(
  request: PersonalAnalysisRequest,
  signal?: AbortSignal,
): Promise<PersonalAnalysisEnvelope> {
  return apiRequest<PersonalAnalysisEnvelope>('/api/personal-analysis', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
    timeoutMs: 180_000,
  });
}
