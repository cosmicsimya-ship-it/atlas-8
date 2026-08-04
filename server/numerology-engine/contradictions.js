/**
 * Cross-number tension / alignment analysis.
 */
import { getNumberProfile } from './meanings.js';

/**
 * @param {object} birthChart
 * @param {object|null} [nameChart]
 */
export function analyzeContradictions(birthChart, nameChart = null) {
  /** @type {Array<{ pair: string, numbers: number[], tension: string, reading: string }>} */
  const tensions = [];
  /** @type {Array<{ pair: string, numbers: number[], note: string }>} */
  const alignments = [];

  if (!birthChart?.ok) return { tensions, alignments };

  const lp = birthChart.lifePath;
  const bd = birthChart.birthday;
  const py = birthChart.personalYear;

  if (lp?.value != null && bd?.value != null && lp.value !== bd.value) {
    const a = getNumberProfile(lp.isMaster ? lp.reduced : lp.value);
    const b = getNumberProfile(bd.isMaster ? bd.reduced : bd.value);
    tensions.push({
      pair: 'lifePath-birthday',
      numbers: [lp.value, bd.value],
      tension: `${lp.display} ↔ ${bd.display}`,
      reading: `Yaşam yolu ${a?.label || lp.display} isterken doğum günü ${b?.label || bd.display} titreşimi taşıyor; uzun vadeli yol ile günlük karakter ritmi farklı çalışabilir.`,
    });
  } else if (lp?.value === bd?.value) {
    alignments.push({
      pair: 'lifePath-birthday',
      numbers: [lp.value],
      note: 'Yaşam yolu ile doğum günü aynı titreşimde; temel kimlik sinyali pekişiyor.',
    });
  }

  if (lp?.isMaster && lp.reduced != null) {
    tensions.push({
      pair: 'master-reduced',
      numbers: [lp.value, lp.reduced],
      tension: `${lp.display}`,
      reading: `Usta frekans ${lp.value} yüksek potansiyel taşırken indirgenmiş ${lp.reduced} günlük ilişki/yapı dersini hatırlatır; ikisi gerilim değil, çift katmanlı çalışma biçimidir.`,
    });
  }

  const activeCycle = birthChart.lifeCycles?.activeCycle;
  if (activeCycle && lp?.value != null && activeCycle.governingNumber !== lp.value) {
    tensions.push({
      pair: 'lifePath-activeCycle',
      numbers: [lp.value, activeCycle.governingNumber],
      tension: `LP ${lp.display} ↔ döngü ${activeCycle.governingDisplay}`,
      reading: `Ana yol ${lp.display} iken aktif ${activeCycle.name} döngüsü ${activeCycle.governingDisplay} ile yönetiliyor; dönemsel tema ana yoldan farklı bir ders seti açabilir.`,
    });
  }

  if (py?.value != null && lp?.value != null && py.value !== lp.value) {
    tensions.push({
      pair: 'lifePath-personalYear',
      numbers: [lp.value, py.value],
      tension: `LP ${lp.display} ↔ PY ${py.display}`,
      reading: `Bu yılın kişisel yılı ${py.display}; ana yol ${lp.display} ile birebir aynı olmak zorunda değil — yıllık tema geçici bir vurgu yaratır.`,
    });
  }

  if (nameChart?.ok) {
    const expr = nameChart.expression;
    const soul = nameChart.soulUrge;
    const pers = nameChart.personality;
    if (soul?.value != null && pers?.value != null && soul.value !== pers.value) {
      tensions.push({
        pair: 'soulUrge-personality',
        numbers: [soul.value, pers.value],
        tension: `${soul.display} ↔ ${pers.display}`,
        reading: 'Ruh arzusu ile kişilik sayısı farklıysa iç motivasyon ile dışa yansıyan maske arasında salınım görülebilir.',
      });
    }
    if (expr?.value != null && lp?.value != null && expr.value !== lp.value) {
      tensions.push({
        pair: 'lifePath-expression',
        numbers: [lp.value, expr.value],
        tension: `${lp.display} ↔ ${expr.display}`,
        reading: 'İsim ifadesi ile yaşam yolu farklı titreşimde; dış kariyer/kimlik ile ruhsal yol çizgisi tamamlayıcı veya gerilimli olabilir.',
      });
    }
  }

  return { tensions, alignments };
}
