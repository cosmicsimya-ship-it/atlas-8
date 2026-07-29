// ═══════════════════════════════════════════════════════════════════════
// Ephemeris layer — verified sky positions via astronomy-engine
// Positions are NOT taken from LLM memory.
// ═══════════════════════════════════════════════════════════════════════

import {
  Body,
  Ecliptic,
  GeoVector,
  Illumination,
  MakeTime,
} from 'astronomy-engine';

const SIGNS = [
  'Koç',
  'Boğa',
  'İkizler',
  'Yengeç',
  'Aslan',
  'Başak',
  'Terazi',
  'Akrep',
  'Yay',
  'Oğlak',
  'Kova',
  'Balık',
];

const PLANETS = [
  { body: Body.Sun, name: 'Güneş' },
  { body: Body.Moon, name: 'Ay' },
  { body: Body.Mercury, name: 'Merkür' },
  { body: Body.Venus, name: 'Venüs' },
  { body: Body.Mars, name: 'Mars' },
  { body: Body.Jupiter, name: 'Jüpiter' },
  { body: Body.Saturn, name: 'Satürn' },
  { body: Body.Uranus, name: 'Uranüs' },
  { body: Body.Neptune, name: 'Neptün' },
  { body: Body.Pluto, name: 'Plüton' },
];

/** Default analysis location when user does not specify (declared in output). */
export const DEFAULT_SKY_LOCATION = {
  name: 'İstanbul',
  latitude: 41.0082,
  longitude: 28.9784,
  timeZone: 'Europe/Istanbul',
};

/**
 * @param {number} longitudeDeg 0-360 ecliptic longitude
 */
export function longitudeToSignDegree(longitudeDeg) {
  let lon = longitudeDeg % 360;
  if (lon < 0) lon += 360;
  const signIndex = Math.floor(lon / 30);
  const degree = lon - signIndex * 30;
  return {
    sign: SIGNS[signIndex],
    signIndex,
    degree: Number(degree.toFixed(2)),
    longitude: Number(lon.toFixed(2)),
  };
}

/**
 * @param {import('astronomy-engine').AstroTime} time
 * @param {import('astronomy-engine').Body} body
 */
function eclipticLongitude(time, body) {
  const vec = GeoVector(body, time, true);
  const ecl = Ecliptic(vec);
  return ecl.elon;
}

/**
 * @param {number} phaseAngle deg from Illumination (0=full? check docs)
 * astronomy-engine Illumination.phase_angle: angle Sun-target-Earth
 * Moon phase_fraction 0..1
 */
function describeMoonPhase(phaseFraction) {
  const f = phaseFraction;
  if (f < 0.03 || f > 0.97) return 'Yeni Ay';
  if (f < 0.22) return 'Hilal (büyüyen)';
  if (f < 0.28) return 'İlk Dördün';
  if (f < 0.47) return 'Şişkin Ay (büyüyen)';
  if (f < 0.53) return 'Dolunay';
  if (f < 0.72) return 'Şişkin Ay (küçülen)';
  if (f < 0.78) return 'Son Dördün';
  return 'Hilal (küçülen)';
}

/**
 * @param {{
 *   when?: Date|string|number,
 *   latitude?: number,
 *   longitude?: number,
 *   locationName?: string,
 *   timeZone?: string,
 * }} [options]
 */
export function buildEphemerisSnapshot(options = {}) {
  const loc = {
    name: options.locationName ?? DEFAULT_SKY_LOCATION.name,
    latitude: options.latitude ?? DEFAULT_SKY_LOCATION.latitude,
    longitude: options.longitude ?? DEFAULT_SKY_LOCATION.longitude,
    timeZone: options.timeZone ?? DEFAULT_SKY_LOCATION.timeZone,
  };

  const date = options.when instanceof Date ? options.when : new Date(options.when ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    return {
      ok: false,
      error: 'INVALID_DATE',
      metadata: { source: 'astronomy-engine', method: 'none' },
    };
  }

  try {
    const time = MakeTime(date);
    const positions = {};

    for (const { body, name } of PLANETS) {
      const lon = eclipticLongitude(time, body);
      const sd = longitudeToSignDegree(lon);
      positions[name] = {
        body: name,
        ...sd,
        display: `${sd.sign} ${sd.degree.toFixed(1)}°`,
      };
    }

    const moonIllum = Illumination(Body.Moon, time);
    const phaseFraction = moonIllum.phase_fraction;
    const moonPhase = describeMoonPhase(phaseFraction);

    // Retrograde: compare ecliptic longitude ~1 day apart
    const retrogrades = [];
    const later = MakeTime(new Date(date.getTime() + 24 * 3600 * 1000));
    for (const { body, name } of PLANETS) {
      if (name === 'Güneş' || name === 'Ay') continue;
      const lon0 = eclipticLongitude(time, body);
      const lon1 = eclipticLongitude(later, body);
      let delta = lon1 - lon0;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      if (delta < 0) retrogrades.push(name);
    }

    return {
      ok: true,
      whenIso: date.toISOString(),
      location: loc,
      sun: positions.Güneş,
      moon: {
        ...positions.Ay,
        phase: moonPhase,
        phaseFraction: Number(phaseFraction.toFixed(3)),
      },
      planets: positions,
      retrogrades,
      metadata: {
        source: 'astronomy-engine',
        method: 'geocentric ecliptic longitude (astronomy-engine)',
        precision: 'ephemeris-library',
        note:
          'Konumlar astronomy-engine ile hesaplanmıştır; model hafızasından uydurulmamıştır. Ay burcu gün içinde değişebilir.',
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message ?? 'EPHEMERIS_FAILURE',
      metadata: { source: 'astronomy-engine', method: 'failed' },
    };
  }
}

/**
 * @param {ReturnType<typeof buildEphemerisSnapshot>} sky
 */
export function formatEphemerisDataBlock(sky) {
  if (!sky?.ok) {
    return `## VERIFIED EPHEMERIS DATA
Gökyüzü konumları hesaplanamadı (${sky?.error ?? 'unknown'}). Gezegen/Ay konumlarını uydurma; belirsizliği belirt.`;
  }

  const lines = Object.values(sky.planets).map((p) => `- ${p.body}: ${p.display}`);
  const retro =
    sky.retrogrades.length > 0 ? sky.retrogrades.join(', ') : 'belirgin retro yok (hesaplanan örneklem)';

  return `## VERIFIED EPHEMERIS DATA (use only these positions)
Analiz anı (UTC): ${sky.whenIso}
Varsayılan konum: ${sky.location.name} (${sky.location.latitude}, ${sky.location.longitude}), ${sky.location.timeZone}
Güneş: ${sky.sun.display}
Ay: ${sky.moon.display} — faz: ${sky.moon.phase} (fraction ${sky.moon.phaseFraction})
Gezegenler:
${lines.join('\n')}
Retro (yaklaşık, 24s delta): ${retro}
Kaynak: ${sky.metadata.method}
${sky.metadata.note}
Kurallar:
- Bu blok dışından gezegen derecesi/burç uydurma.
- Konumu kullanıcıya açıkça belirt (varsayılan ${sky.location.name}).
- Kesin olay tahmini yapma; sembolik/yorumlayıcı çerçevede kal.`;
}
