import { ApiError } from '../services/api-client';
import type { PersonalAnalysisEnvelope, PersonalAnalysisStatus } from '../types/personal-analysis';

/** Wire shape for a single archive analysis (shared by list/get/post). */
export type ArchiveRecordWire = {
  id: string;
  title: string;
  intention: string;
  status: PersonalAnalysisStatus | string;
  name: string | null;
  referenceDate: string | null;
  createdAt: string;
  updatedAt: string;
  formSummary: Record<string, unknown>;
  envelope: PersonalAnalysisEnvelope | null;
};

/**
 * Backend GET /api/archive/:userId/:analysisId returns:
 *   { userId, analysis: ArchiveRecordWire }
 * List/POST wrap as { analyses } / { record }.
 * Older clients may receive a bare record — accept both.
 */
export function unwrapArchiveRecordPayload(payload: unknown): ArchiveRecordWire {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('Arşiv yanıtı okunamadı.', 502, payload);
  }

  const root = payload as Record<string, unknown>;
  const candidate =
    root.analysis && typeof root.analysis === 'object'
      ? root.analysis
      : root.record && typeof root.record === 'object'
        ? root.record
        : root;

  const record = candidate as Partial<ArchiveRecordWire>;
  if (!record.id || typeof record.id !== 'string') {
    throw new ApiError('Arşiv kaydı incomplete veya tanımsız.', 502, payload);
  }

  return {
    id: record.id,
    title: String(record.title ?? 'Analiz'),
    intention: String(record.intention ?? ''),
    status: record.status ?? 'complete',
    name: record.name ?? null,
    referenceDate: record.referenceDate ?? null,
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    updatedAt: String(record.updatedAt ?? new Date().toISOString()),
    formSummary: (record.formSummary as Record<string, unknown>) ?? {},
    envelope: record.envelope ?? null,
  };
}

/** Map transport/API failures to Atlas-tone copy (never raw "Request failed"). */
export function archiveLoadUserMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return 'Bu analiz kaydı bulunamadı. Arşive dönüp listeden tekrar açabilirsin.';
    }
    if (err.status === 401 || err.status === 403) {
      return 'Bu kaydı görmek için oturumun gerekli. Giriş yapıp tekrar dene.';
    }
    const category =
      err.body && typeof err.body === 'object'
        ? String((err.body as { errorCategory?: string }).errorCategory ?? '')
        : '';
    if (err.status === 408 || category === 'request_timeout') {
      return 'Arşiv yanıtı zamanında gelmedi. Birkaç saniye sonra tekrar dene.';
    }
    if (err.status === 0 || category === 'network_error') {
      return 'Bağlantı kurulamadı. Ağını kontrol edip yeniden dene.';
    }
    if (
      err.message &&
      !/^Request failed/i.test(err.message) &&
      !/^Invalid JSON/i.test(err.message) &&
      !/^Arşiv kaydı incomplete/i.test(err.message)
    ) {
      return err.message;
    }
    if (/^Invalid JSON/i.test(err.message) || /incomplete/i.test(err.message)) {
      return 'Arşiv yanıtı beklenen biçimde gelmedi. Lütfen tekrar dene.';
    }
    return 'Arşiv kaydı şu an açılamadı. Lütfen tekrar dene.';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Arşiv kaydı şu an açılamadı. Lütfen tekrar dene.';
}

export type EmptyEnvelopeReason =
  | 'missing_envelope'
  | 'empty_synthesis'
  | 'insufficient_data'
  | 'reject';

export function emptyResultUserCopy(reason: EmptyEnvelopeReason): {
  title: string;
  body: string;
  actionHint: string;
} {
  switch (reason) {
    case 'insufficient_data':
      return {
        title: 'Eksik bilgi',
        body: 'Bu okuma için yeterli profil veya doğum verisi yok. Eksik alanları tamamlayınca Atlas denklemi yeniden kurabilir.',
        actionHint: 'Yeni Analiz ile doğum bilgilerini ekle.',
      };
    case 'reject':
      return {
        title: 'Bu istek işlenemedi',
        body: 'Mevcut verilerle güvenilir bir sentez kurulamadı. Niyeti netleştirmek veya bilgileri gözden geçirmek yardımcı olur.',
        actionHint: 'İstersen Atlas sohbetinde aynı soruyu bağlamıyla sor.',
      };
    case 'empty_synthesis':
      return {
        title: 'Sentez bölümü boş',
        body: 'Kayıt duruyor ama gösterilecek sentez metni yok. Bu bir sistem çökmesi değil; çıktı eksik kaldı.',
        actionHint: 'Yeni bir analiz çalıştırabilir veya Atlas’a sorabilirsin.',
      };
    case 'missing_envelope':
    default:
      return {
        title: 'Sonuç gövdesi eksik',
        body: 'Bu arşiv kaydında analiz gövdesi saklanmamış. Liste kaydı duruyor olabilir; içeriği yeniden üretmek gerekir.',
        actionHint: 'Yeni Analiz başlat veya arşive dön.',
      };
  }
}
