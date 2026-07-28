import type { PersonalAnalysisEnvelope, PersonalAnalysisStatus } from '../types/personal-analysis';
import { apiRequest } from './api-client';

export interface AnalysisFormSummary {
  name?: string;
  birthDate?: string;
  birthTime?: string | null;
  birthPlace?: string;
  location?: string;
  referenceDate?: string;
  intention?: string;
  customQuestion?: string;
}

export interface AnalysisArchiveRecord {
  id: string;
  title: string;
  intention: string;
  status: PersonalAnalysisStatus | string;
  name: string | null;
  referenceDate: string | null;
  createdAt: string;
  updatedAt: string;
  formSummary: AnalysisFormSummary;
  envelope: PersonalAnalysisEnvelope | null;
}

export async function listArchive(userId: string): Promise<AnalysisArchiveRecord[]> {
  const data = await apiRequest<{ analyses: AnalysisArchiveRecord[] }>(
    `/api/archive/${encodeURIComponent(userId)}`,
  );
  return data.analyses ?? [];
}

export async function getArchiveRecord(
  userId: string,
  analysisId: string,
): Promise<AnalysisArchiveRecord> {
  return apiRequest<AnalysisArchiveRecord>(
    `/api/archive/${encodeURIComponent(userId)}/${encodeURIComponent(analysisId)}`,
  );
}

export async function saveArchiveRecord(
  userId: string,
  record: AnalysisArchiveRecord,
): Promise<AnalysisArchiveRecord> {
  const data = await apiRequest<{ record: AnalysisArchiveRecord }>(
    `/api/archive/${encodeURIComponent(userId)}`,
    { method: 'POST', body: JSON.stringify({ record }) },
  );
  return data.record;
}

export async function deleteArchiveRecord(userId: string, analysisId: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(
    `/api/archive/${encodeURIComponent(userId)}/${encodeURIComponent(analysisId)}`,
    { method: 'DELETE' },
  );
}
