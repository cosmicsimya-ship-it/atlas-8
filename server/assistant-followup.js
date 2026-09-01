/**
 * Assistant-anchored follow-up continuity.
 *
 * When the user says "mesela", "ikincisi", "nasıl yani", etc., resolve against
 * the previous assistant turn instead of asking them to restate Atlas's own claim.
 * Extends referential/conversation layers — not a parallel router.
 */

/**
 * @typedef {{
 *   index: number,
 *   label: string,
 *   semanticTarget: string,
 *   semanticIntent: string,
 * }} OfferedOption
 */

/**
 * @typedef {{
 *   resolved: boolean,
 *   kind: 'example'|'ordinal'|'clarify_claim'|'continue'|'which'|'label_match'|'client_selection'|null,
 *   sufficient: boolean,
 *   selectedOption?: OfferedOption|null,
 *   rewriteMessage?: string|null,
 *   continuityDirective?: string|null,
 *   reason?: string,
 * }} FollowUpResolution
 */

const EXAMPLE_RE =
  /^(mesela|mesel[aâ]|[oö]rnek(\s+ver([ir] misin)?)?|[oö]rne[gğ]in|for\s+example|e\.g\.?)[.!?…]*$/iu;

const CLARIFY_CLAIM_RE =
  /^(nas[ıi]l\s+yani|ne\s+demek(\s+istiyorsun)?|ne\s+demek\?|bunu\s+a[cç]|[sş]unu\s+anlat|neden\?|peki\s+sonra\??|yani\??)[.!?…]*$/iu;

const CONTINUE_RE =
  /^(devam(\s+et)?|devam\s+et\s+l[uü]tfen|s[uü]rd[uü]r|daha\s+(anlat|s[oö]yle)|biraz\s+daha)[.!?…]*$/iu;

const WHICH_RE =
  /^(hangisi|bunlardan\s+hangisi|hangi\s+biri|hangisini)[.!?…]*$/iu;

// Anchored to the WHOLE message (optionally + a light "open/expand this one"
// tail) — deliberately does not allow the ordinal word to be followed by an
// unrelated noun/clause. "ilk" is an ordinary Turkish word for "first" used
// in countless unrelated sentences ("ilk dünya savaşı", "ilk şeytan hangi
// dinde belirdi", "ilk kez"...); without this anchor, ANY short message that
// merely contains an ordinal word anywhere gets misread as "select option N"
// whenever a prior assistant turn offered options — see
// scripts/test-ordinal-followup-precision.mjs for the regression this fixes.
const ORDINAL_RE =
  /^(birinci(si)?(ni)?|ikinci(si)?(ni)?|üçüncü(sü)?(n[uü])?|ucuncu(su)?(nu)?|d[oö]rd[uü]nc[uü](sü)?(n[uü])?|be[sş]inci(si)?(ni)?|1\.?(si)?(ni)?|2\.?(si)?(ni)?|3\.?(si)?(ni)?|4\.?(si)?(ni)?|5\.?(si)?(ni)?|ilk(i)?(ni)?|son(uncu)?(su)?(nu)?)\s*(?:m[ıi]|olan[ıi]?|se[cç]ene[gğ]i(?:ni)?)?\s*(?:a[cç](?:ar\s+m[ıi]s[ıi]n)?|anlat(?:[ıi]r\s+m[ıi]s[ıi]n)?|g[oö]ster(?:ir\s+m[ıi]sin)?|geni[sş]let|detayland[ıi]r|a[cç][ıi]kla)?\s*[.!?…]*$/iu;

/**
 * @param {string} label
 */
export function slugSemanticTarget(label) {
  return String(label || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşıöç\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 64);
}

/**
 * Extract offered options from an assistant reply.
 * @param {string} text
 * @returns {OfferedOption[]}
 */
export function extractOfferedOptions(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  /** @type {OfferedOption[]} */
  const options = [];
  const seen = new Set();

  const push = (label, intent = 'expand_pattern_interpretation') => {
    const clean = String(label || '')
      .replace(/^[-•·*\d.)\]]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length < 3 || clean.length > 120) return;
    const key = clean.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) return;
    seen.add(key);
    options.push({
      index: options.length + 1,
      label: clean,
      semanticTarget: slugSemanticTarget(clean),
      semanticIntent: intent,
    });
  };

  // Numbered / lettered lines
  const numbered = [
    ...raw.matchAll(
      /(?:^|\n)\s*(?:[-•·*]|\(?\d{1,2}\)?[.)]|[a-eA-E][.)])\s+([^\n]{3,120})/g,
    ),
  ];
  for (const m of numbered) push(m[1]);

  if (options.length >= 2) return options.slice(0, 8);

  // "X, Y veya Z olabilir / olabilir"
  const orList = raw.match(
    /([^.!?\n]{3,80}?),\s*([^.!?\n]{3,80}?)\s+veya\s+([^.!?\n]{3,80}?)(?:\s+olabilir)?/i,
  );
  if (orList) {
    push(orList[1]);
    push(orList[2]);
    push(orList[3].replace(/\s+olabilir\.?$/i, ''));
    if (options.length >= 2) return options.slice(0, 8);
  }

  // Semicolon / em-dash separated short clauses after "olabilir"
  const maybe = raw.match(
    /(?:olabilir|örneğin|mesela)[:\s]+([^.!?]{10,200})/i,
  );
  if (maybe) {
    const parts = maybe[1]
      .split(/\s*;\s*|\s+[—–-]\s+|\s+\/\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      for (const p of parts) push(p);
      if (options.length >= 2) return options.slice(0, 8);
    }
  }

  return options.slice(0, 8);
}

/**
 * @param {string} message
 */
export function detectAssistantAnchoredFollowUp(message) {
  const text = String(message || '').trim();
  if (!text || text.length > 120) return { kind: null };

  if (EXAMPLE_RE.test(text) || /^(mesela|mesel[aâ]|[oö]rne[gğ]in)\b/iu.test(text)) {
    return { kind: 'example' };
  }
  if (CLARIFY_CLAIM_RE.test(text)) return { kind: 'clarify_claim' };
  if (CONTINUE_RE.test(text)) return { kind: 'continue' };
  if (WHICH_RE.test(text)) return { kind: 'which' };

  const t = text.toLocaleLowerCase('tr-TR');
  // Prefer longer ordinal tokens first so "ikincisi" is not read as containing "1".
  let n = null;
  if (/\b(be[sş]inci(si)?(ni)?|5\.?(si)?)\b/.test(t)) n = 5;
  else if (/\b(d[oö]rd[uü]nc[uü](sü)?(n[uü])?|4\.?(si)?)\b/.test(t)) n = 4;
  else if (/\b([uü]ç[uü]nc[uü](sü)?(n[uü])?|ucuncu(su)?(nu)?|3\.?(si)?)\b/.test(t)) n = 3;
  else if (/\b(ikinci(si)?(ni)?|2\.?(si)?)\b/.test(t)) n = 2;
  else if (/\b(birinci(si)?(ni)?|ilk(i)?(ni)?|1\.?(si)?)\b/.test(t)) n = 1;
  else if (/\b(son(uncu)?(su)?(nu)?)\b/.test(t) && text.length <= 40) n = -1;

  // ORDINAL_RE alone (no length-based fallback): a bare short message must
  // actually BE an ordinal-selection utterance, not merely contain an
  // ordinal word inside an unrelated sentence — see the comment on
  // ORDINAL_RE above. Tested against `t` (already tr-TR-lowercased), not
  // the raw `text` — JS's /i flag folds Turkish "İ" to "i̇" (i + combining
  // dot), not plain "i", so raw-text matching silently rejects "İkincisi".
  if (n != null && ORDINAL_RE.test(t)) {
    return { kind: 'ordinal', ordinal: n };
  }

  return { kind: null };
}

/**
 * Last assistant content from history.
 * @param {{ role?: string, content?: string, text?: string }[]} history
 */
export function getLastAssistantText(history = []) {
  for (let i = (history || []).length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (!turn) continue;
    if (turn.role !== 'assistant' && turn.role !== 'atlas') continue;
    const content =
      typeof turn.content === 'string'
        ? turn.content
        : typeof turn.text === 'string'
          ? turn.text
          : '';
    if (content.trim()) return content.trim();
  }
  return null;
}

/**
 * @param {string} message
 * @param {OfferedOption[]} options
 */
function matchLabelOption(message, options) {
  const fold = String(message || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[.!?…]+$/g, '')
    .trim();
  if (!fold || fold.length < 3) return null;
  for (const opt of options) {
    const label = opt.label.toLocaleLowerCase('tr-TR');
    if (fold === label || label.includes(fold) || fold.includes(label)) {
      return opt;
    }
  }
  return null;
}

/**
 * Resolve a short follow-up against the previous assistant turn / offered options.
 * @param {{
 *   message: string,
 *   history?: Array<{ role?: string, content?: string }>,
 *   offeredOptions?: OfferedOption[]|null,
 *   clientSelection?: Partial<OfferedOption>|null,
 *   lastAssistantIntent?: string|null,
 * }} input
 * @returns {FollowUpResolution}
 */
export function resolveAssistantFollowUp(input) {
  const message = String(input.message || '').trim();
  const history = input.history || [];
  const lastText = getLastAssistantText(history);
  const storedOptions = Array.isArray(input.offeredOptions) ? input.offeredOptions : [];
  const extracted = lastText ? extractOfferedOptions(lastText) : [];
  const options = storedOptions.length >= 2 ? storedOptions : extracted;

  // Structured client selection (UI option click)
  const client = input.clientSelection;
  if (client && (client.label || client.semanticTarget || client.index != null)) {
    const byIndex =
      client.index != null
        ? options.find((o) => o.index === Number(client.index))
        : null;
    const selected =
      byIndex ||
      (client.label ? matchLabelOption(String(client.label), options) : null) ||
      {
        index: Number(client.index) || 1,
        label: String(client.label || client.semanticTarget || 'seçilen yön'),
        semanticTarget: String(client.semanticTarget || slugSemanticTarget(client.label || '')),
        semanticIntent: String(client.semanticIntent || 'expand_pattern_interpretation'),
      };
    return {
      resolved: true,
      kind: 'client_selection',
      sufficient: true,
      selectedOption: selected,
      rewriteMessage: `${selected.label} yönünü aç: önceki Atlas cevabındaki bu seçeneği genişlet.`,
      continuityDirective: [
        'ASSISTANT-ANCHORED FOLLOW-UP (UI selection):',
        `User selected option "${selected.label}" (target=${selected.semanticTarget}).`,
        'Do NOT ask what they meant. Expand that option from your previous reply.',
      ].join('\n'),
      reason: 'client_selection',
    };
  }

  const detected = detectAssistantAnchoredFollowUp(message);
  if (!detected.kind) {
    // Free-text label match against offered options
    if (options.length >= 2) {
      const hit = matchLabelOption(message, options);
      if (hit && message.length <= 80) {
        return {
          resolved: true,
          kind: 'label_match',
          sufficient: true,
          selectedOption: hit,
          rewriteMessage: `${hit.label} yönünü aç: önceki Atlas cevabındaki bu seçeneği genişlet.`,
          continuityDirective: [
            'ASSISTANT-ANCHORED FOLLOW-UP (label match):',
            `User pointed at option "${hit.label}".`,
            'Do NOT ask for re-description. Expand that option.',
          ].join('\n'),
          reason: 'label_match',
        };
      }
    }
    return {
      resolved: false,
      kind: null,
      sufficient: false,
      reason: 'not_anchored',
    };
  }

  if (!lastText) {
    // No assistant prior — leave to normal clarification / LLM
    return {
      resolved: false,
      kind: detected.kind,
      sufficient: false,
      reason: 'no_assistant_prior',
    };
  }

  if (detected.kind === 'ordinal') {
    if (options.length < 1) {
      // Still anchored to prior claim — ask which option only if we truly have none
      return {
        resolved: true,
        kind: 'ordinal',
        sufficient: true,
        selectedOption: null,
        rewriteMessage: `Önceki cevapta sunduğun seçeneklerden ${message} olanı aç.`,
        continuityDirective: [
          'ASSISTANT-ANCHORED FOLLOW-UP (ordinal):',
          `User said "${message}" referring to your previous reply.`,
          'Do NOT ask "ne demek istedin?". Expand the matching option from your last message.',
        ].join('\n'),
        reason: 'ordinal_without_parsed_options',
      };
    }
    let idx = detected.ordinal;
    if (idx === -1) idx = options.length;
    const selected = options.find((o) => o.index === idx) || options[idx - 1] || null;
    if (!selected) {
      return {
        resolved: true,
        kind: 'which',
        sufficient: true,
        rewriteMessage: 'Önceki seçeneklerden hangisini açmamı istediğini netleştirmeden, listedeki seçenekleri kısaca hatırlat ve seçmesini iste.',
        continuityDirective:
          'User used an ordinal but it did not match. Briefly restate the options; do not abandon the prior topic.',
        reason: 'ordinal_out_of_range',
      };
    }
    return {
      resolved: true,
      kind: 'ordinal',
      sufficient: true,
      selectedOption: selected,
      rewriteMessage: `${selected.label} yönünü aç: önceki Atlas cevabındaki bu seçeneği genişlet.`,
      continuityDirective: [
        'ASSISTANT-ANCHORED FOLLOW-UP (ordinal):',
        `User selected #${selected.index}: "${selected.label}".`,
        'Do NOT ask what they meant. Expand that option from your previous reply.',
      ].join('\n'),
      reason: 'ordinal_resolved',
    };
  }

  if (detected.kind === 'example') {
    const first = options[0] || null;
    return {
      resolved: true,
      kind: 'example',
      sufficient: true,
      selectedOption: first,
      rewriteMessage: first
        ? `Önceki cevabına somut bir örnek ver; özellikle "${first.label}" bağlamında.`
        : 'Önceki Atlas cevabındaki ana iddiaya somut bir örnek ver. Kullanıcıya "mesela ne?" diye sorma.',
      continuityDirective: [
        'ASSISTANT-ANCHORED FOLLOW-UP (example):',
        'User asked for an example of YOUR previous claim/options.',
        'Do NOT ask them to restate. Give a concrete example from the prior reply.',
      ].join('\n'),
      reason: 'example_request',
    };
  }

  if (detected.kind === 'clarify_claim') {
    return {
      resolved: true,
      kind: 'clarify_claim',
      sufficient: true,
      rewriteMessage: 'Önceki Atlas cevabındaki ana iddiayı daha açık ve somut anlat.',
      continuityDirective: [
        'ASSISTANT-ANCHORED FOLLOW-UP (clarify prior claim):',
        'User asked what you meant. Explain YOUR last assertion — do not ask them what they meant.',
      ].join('\n'),
      reason: 'clarify_prior_claim',
    };
  }

  if (detected.kind === 'continue') {
    return {
      resolved: true,
      kind: 'continue',
      sufficient: true,
      rewriteMessage: 'Önceki konuda kaldığın yerden devam et; aynı bağlamı koru.',
      continuityDirective: [
        'ASSISTANT-ANCHORED FOLLOW-UP (continue):',
        'Continue the same topic from your previous reply. Do not restart or ask for topic.',
      ].join('\n'),
      reason: 'continue_prior',
    };
  }

  if (detected.kind === 'which') {
    if (options.length >= 2) {
      const listed = options.map((o) => `${o.index}) ${o.label}`).join('; ');
      return {
        resolved: true,
        kind: 'which',
        sufficient: true,
        rewriteMessage: `Önceki seçenekleri kısaca hatırlat (${listed}) ve hangisini açacağını sor — konuyu terk etme.`,
        continuityDirective:
          'User asked which option. Restate your offered options briefly; keep the same topic.',
        reason: 'which_restate_options',
      };
    }
    return {
      resolved: true,
      kind: 'which',
      sufficient: true,
      rewriteMessage: 'Önceki cevabındaki ana yönleri kısaca ayırarak hatırlat.',
      continuityDirective:
        'User asked which. Distinguish the directions in your previous reply without abandoning context.',
      reason: 'which_without_options',
    };
  }

  return { resolved: false, kind: null, sufficient: false, reason: 'unhandled' };
}

/**
 * Prompt block for founder public-profile example follow-ups.
 * @param {Record<string, unknown>} fields
 */
export function buildFounderExampleFollowUpDirective(fields) {
  const work = Array.isArray(fields.workAreas) ? fields.workAreas.join(', ') : '';
  return [
    'ASSISTANT-ANCHORED FOLLOW-UP (founder public profile):',
    'User wants an example of Lara\'s public work. Use ONLY approved public fields.',
    work ? `Public work areas: ${work}` : '',
    'Be factual and short. No PR hyperbole. No private data.',
  ]
    .filter(Boolean)
    .join('\n');
}

export const ASSISTANT_FOLLOWUP_VERSION = 'atlas-assistant-followup-v1';
