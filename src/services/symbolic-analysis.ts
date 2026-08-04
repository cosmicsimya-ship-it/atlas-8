import type {
  SymbolicAnalysisRequest,
  SymbolicAnalysisResponse,
} from '../types/symbolic-analysis';
import { apiRequest } from './api-client';

export async function submitSymbolicAnalysis(
  request: SymbolicAnalysisRequest,
  signal?: AbortSignal,
): Promise<SymbolicAnalysisResponse> {
  return apiRequest<SymbolicAnalysisResponse>('/api/symbolic-analysis', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
    timeoutMs: 60_000,
  });
}
