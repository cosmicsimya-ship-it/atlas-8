/**
 * Faith / crisis sensitivity guards for synthesis presentation.
 */

const CRISIS_HINTS =
  /\b(intihar|öldür|kendimi\s+öld|azap|cehennem|lanet|günahkâr|gunahkar|ceza\s+gelecek|allah\s+cezaland)\b/i;

const HIGH_STAKES =
  /\b(fetva|boşanma\s+kararı|ameliyat|yatırım\s+kararı|miras|cihat|dini\s+hüküm)\b/i;

/**
 * @param {string} [userMessage]
 * @param {import('./schema.js').NormalizedLayer[]} [layers]
 * @returns {{
 *   crisisRisk: boolean,
 *   highStakesDecision: boolean,
 *   boundaryNotes: string[],
 *   redirectTone: string|null
 * }}
 */
export function evaluateFaithSafety(userMessage = '', layers = []) {
  const corpus = [
    userMessage,
    ...layers.map((l) => [l.interpretation, ...(l.themes ?? []), ...(l.cautions ?? [])].join(' ')),
  ].join('\n');

  const crisisRisk = CRISIS_HINTS.test(corpus);
  const highStakesDecision = HIGH_STAKES.test(corpus);
  const boundaryNotes = [
    'Atlas dini otorite gibi konuşmaz ve fetva vermez.',
    'İlahi irade hakkında kesin hüküm verilmez.',
    'Astroloji/numeroloji Kur’an’ın doğrulayıcısı olarak sunulmaz.',
  ];

  if (crisisRisk) {
    boundaryNotes.push(
      'Ruhsal kriz veya suçluluk artırıcı dil kullanılmaz; kişiye doğrudan ceza/azap yöneltilmez.',
    );
  }
  if (highStakesDecision) {
    boundaryNotes.push(
      'Ciddi dini, hukuki, tıbbi veya hayati kararlar için uygun uzman / güvenilir rehberlik sınırları hatırlatılır.',
    );
  }

  return {
    crisisRisk,
    highStakesDecision,
    boundaryNotes,
    redirectTone: crisisRisk || highStakesDecision
      ? 'Bu konuda Atlas yalnızca düşünme alanı açabilir; kesin dini/hukuki/tıbbi karar yerine geçmez.'
      : null,
  };
}

/**
 * Strip person-directed damnation / fear amplification from draft text.
 * @param {string} text
 * @returns {string}
 */
export function softenFearLanguage(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/sen\s+cehennem[^.!?]*/gi, 'bu tema genel bir uyarı çerçevesinde okunabilir')
    .replace(/allah\s+seni\s+cezaland[^.!?]*/gi, 'kişisel ceza hükmü verilmez')
    .replace(/\bazap\s+seni\b/gi, 'zorlayıcı bir tema');
}
