import type { PersonalAnalysisEnvelope } from '../types/personal-analysis';

export interface ResultSection {
  id: string;
  title: string;
  content: string;
}

function confidenceLabel(score: number): string {
  if (score >= 0.7) return 'Yüksek';
  if (score >= 0.4) return 'Orta';
  return 'Düşük';
}

export function formatAnalysisSections(envelope: PersonalAnalysisEnvelope): ResultSection[] {
  const sections: ResultSection[] = [];
  const s = envelope.payload?.synthesis;
  if (!s) return sections;

  if (s.core_pattern?.trim()) {
    sections.push({ id: 'core', title: 'Ana Örüntü', content: s.core_pattern.trim() });
  }
  if (s.life_architecture?.trim()) {
    sections.push({
      id: 'architecture',
      title: 'Yaşam Mimarisi',
      content: s.life_architecture.trim(),
    });
  }
  if (s.development_axis?.trim()) {
    sections.push({
      id: 'development',
      title: 'Gelişim Ekseni',
      content: s.development_axis.trim(),
    });
  }
  if (s.current_cycle?.trim()) {
    sections.push({ id: 'cycle', title: 'Mevcut Döngü', content: s.current_cycle.trim() });
  }

  if (Array.isArray(s.convergences) && s.convergences.length > 0) {
    const content = s.convergences
      .map((c) => {
        const systems = c.systems?.join(', ') ?? '';
        return systems ? `[${systems}] ${c.summary}` : c.summary;
      })
      .join('\n\n');
    sections.push({ id: 'convergences', title: 'Destekleyen Sistemler', content });
  }

  if (Array.isArray(s.contradictions) && s.contradictions.length > 0) {
    const content = s.contradictions
      .map((c) => {
        const positions = c.positions?.map((p) => `${p.system}: ${p.claim}`).join(' | ') ?? '';
        return `${c.topic}\n${positions}`;
      })
      .join('\n\n');
    sections.push({ id: 'tensions', title: 'İç Gerilimler', content });
  }

  if (Array.isArray(s.recommended_directions) && s.recommended_directions.length > 0) {
    sections.push({
      id: 'directions',
      title: 'Karar ve Yön İpuçları',
      content: s.recommended_directions.map((d, i) => `${i + 1}. ${d}`).join('\n'),
    });
  }

  if (Array.isArray(s.potential_gates) && s.potential_gates.length > 0) {
    sections.push({
      id: 'gates',
      title: 'Olası Geçiş Noktaları',
      content: s.potential_gates.map((g) => `• ${g}`).join('\n'),
    });
  }

  if (s.confidence) {
    sections.push({
      id: 'confidence',
      title: 'Güven Seviyesi',
      content: `Genel: ${confidenceLabel(s.confidence.overall)} (${Math.round(s.confidence.overall * 100)}%)`,
    });
  }

  if (Array.isArray(s.source_systems) && s.source_systems.length > 0) {
    sections.push({
      id: 'sources',
      title: 'Kaynak Sistemler',
      content: s.source_systems.join(', '),
    });
  }

  if (Array.isArray(s.missing_data) && s.missing_data.length > 0) {
    sections.push({
      id: 'missing',
      title: 'Eksik Veri',
      content: s.missing_data.map((m) => `• ${m}`).join('\n'),
    });
  }

  if (Array.isArray(s.warnings) && s.warnings.length > 0) {
    sections.push({
      id: 'warnings',
      title: 'Uyarılar',
      content: s.warnings.map((w) => `• ${w}`).join('\n'),
    });
  }

  return sections;
}

export function buildResultPlainText(
  title: string,
  envelope: PersonalAnalysisEnvelope,
): string {
  const sections = formatAnalysisSections(envelope);
  const header = `${title}\nDurum: ${envelope.status}\n`;
  const body = sections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
  return `${header}\n${body}`.trim();
}

export function statusPresentation(status: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger';
} {
  switch (status) {
    case 'complete':
      return { label: 'Tamamlandı', tone: 'success' };
    case 'insufficient_data':
      return { label: 'Yetersiz Veri', tone: 'warning' };
    case 'reject':
      return { label: 'Reddedildi', tone: 'danger' };
    default:
      return { label: status, tone: 'warning' };
  }
}
