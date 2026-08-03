/**
 * Western tropical natal methodology — registry source of truth for v1 defaults.
 */

export const WESTERN_TROPICAL_NATAL_V1 = Object.freeze({
  methodologyId: 'western-tropical-natal-v1',
  methodologyVersion: '1.0.0',
  rulesetVersion: 'western-tropical-natal-rules-1.0.0',
  displayName: 'Western Tropical Natal Astrology v1',
  domain: 'astrology',
  status: 'active',
  zodiacSystem: 'tropical',
  defaultHouseSystem: 'placidus',
  supportedHouseSystems: Object.freeze(['placidus', 'whole-sign', 'equal']),
  supportedZodiacSystems: Object.freeze(['tropical']),
  // Sidereal architecture reserved; not active in v1 calculation path.
  siderealReady: true,
  ayanamsaDefault: null,
  ephemerisProvider: 'astronomy-engine',
  ephemerisProviderVersion: '2.1.19',
  aspectOrbs: Object.freeze({
    conjunction: 8,
    opposition: 8,
    trine: 7,
    square: 7,
    sextile: 5,
  }),
  minorAspectOrbs: Object.freeze({
    quincunx: 3,
    semisextile: 2,
    semisquare: 2,
    sesquiquadrate: 2,
    quintile: 2,
    biquintile: 2,
  }),
  /** Extra orb degrees when Sun or Moon is involved in a major aspect. */
  luminaryBonus: 2,
  luminaryBodies: Object.freeze(['Sun', 'Moon']),
  /** Bodies counted in element / modality / polarity distributions. */
  distributionBodies: Object.freeze([
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
  ]),
  /** Bodies counted in hemisphere / quadrant stats (requires houses). */
  houseStatBodies: Object.freeze([
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
  ]),
  includeMinorAspectsByDefault: false,
  includePatternsByDefault: true,
  disclaimer:
    'Tropikal zodyak + seçilen ev sistemi. Hesaplanan yerleşimler astronomik/ephemeris tabanlıdır; ' +
    'yorumlar semboliktir. Sağlık, hukuk, finans veya kesin kader iddiası üretmez.',
  limitations: Object.freeze([
    'Chiron astronomy-engine ile güvenilir biçimde desteklenmediği için v1’de hesaplanmaz.',
    'Kuzey/Güney Düğüm mean node formülü ile hesaplanır (true node değil).',
    'Sideral zodyak v1’de aktif hesaplanmaz; mimari rezervlidir.',
    'Placidus kutup enlemlerinde (~±66°) kararsız olabilir; uyarı üretilir.',
  ]),
});

export const NATAL_ENGINE_VERSION = '1.0.0';

/**
 * @param {string} [methodologyId]
 */
export function resolveNatalMethodology(methodologyId) {
  const id = methodologyId || WESTERN_TROPICAL_NATAL_V1.methodologyId;
  if (id === WESTERN_TROPICAL_NATAL_V1.methodologyId) {
    return WESTERN_TROPICAL_NATAL_V1;
  }
  return null;
}
