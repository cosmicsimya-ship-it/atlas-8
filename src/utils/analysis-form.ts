export type AnalysisIntention =
  | 'self-understanding'
  | 'relationship'
  | 'current-period'
  | 'patterns'
  | 'decision'
  | 'custom';

export interface AnalysisFormData {
  name: string;
  birthDate: string;
  birthTime: string;
  birthTimeUnknown: boolean;
  birthPlace: string;
  location: string;
  referenceDate: string;
  intention: AnalysisIntention;
  customQuestion: string;
}

export const INTENTION_OPTIONS: { id: AnalysisIntention; label: string }[] = [
  { id: 'self-understanding', label: 'Kendimi anlamak' },
  { id: 'relationship', label: 'İlişki dinamiği' },
  { id: 'current-period', label: 'İçinde bulunduğum dönem' },
  { id: 'patterns', label: 'Tekrarlayan örüntüler' },
  { id: 'decision', label: 'Karar aşaması' },
  { id: 'custom', label: 'Özel soru' },
];

export const ANALYSIS_STEPS = [
  'Ad',
  'Doğum tarihi',
  'Doğum saati',
  'Doğum yeri',
  'Konum',
  'Referans tarihi',
  'Niyet',
  'Onay',
] as const;

export function createDefaultForm(): AnalysisFormData {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  return {
    name: '',
    birthDate: '',
    birthTime: '',
    birthTimeUnknown: false,
    birthPlace: '',
    location: '',
    referenceDate: iso,
    intention: 'self-understanding',
    customQuestion: '',
  };
}

export function parseDisplayDateToIso(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export function validateStep(step: number, data: AnalysisFormData): string | null {
  switch (step) {
    case 0:
      if (!data.name.trim() || data.name.trim().length < 2) {
        return 'Lütfen adını veya tercih ettiğin hitap şeklini gir.';
      }
      return null;
    case 1: {
      const iso = parseDisplayDateToIso(data.birthDate);
      if (!iso) return 'Geçerli bir doğum tarihi gir (GG.AA.YYYY).';
      return null;
    }
    case 2:
      if (!data.birthTimeUnknown && !/^\d{1,2}[:.]\d{2}$/.test(data.birthTime.trim())) {
        return 'Doğum saatini SS:DD biçiminde gir veya “Bilmiyorum” seç.';
      }
      return null;
    case 3:
      if (!data.birthPlace.trim()) return 'Doğum yerini gir.';
      return null;
    case 4:
      if (!data.location.trim()) return 'Güncel konumunu gir.';
      return null;
    case 5:
      if (!parseDisplayDateToIso(data.referenceDate)) {
        return 'Geçerli bir referans tarihi gir.';
      }
      return null;
    case 6:
      if (data.intention === 'custom' && !data.customQuestion.trim()) {
        return 'Özel sorunu kısaca yaz.';
      }
      return null;
    default:
      return null;
  }
}

export function intentionLabel(id: AnalysisIntention): string {
  return INTENTION_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function buildAnalysisTitle(data: AnalysisFormData): string {
  const label = intentionLabel(data.intention);
  return data.name.trim() ? `${data.name.trim()} — ${label}` : label;
}

export function buildUserNotes(data: AnalysisFormData): string {
  const parts = [
    `Niyet: ${intentionLabel(data.intention)}`,
    data.intention === 'custom' && data.customQuestion
      ? `Soru: ${data.customQuestion.trim()}`
      : null,
    `Referans tarihi: ${data.referenceDate}`,
    `Güncel konum: ${data.location.trim()}`,
    `Ad: ${data.name.trim()}`,
  ].filter(Boolean);
  return parts.join('\n');
}
