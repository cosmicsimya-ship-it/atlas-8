/**
 * Progressive disclosure rules — capabilities are earned through interaction,
 * never listed as a marketing catalog.
 *
 * Journey: connect → speak → discover
 */

import {
  capabilityModules,
  type CapabilityModule,
  type CapabilityModuleId,
} from './atlas-capabilities';

/** Minimum completed user→assistant exchanges before any capability whisper. */
export const DISCOVERY_MIN_EXCHANGES = 1;

/** Unlock order when conversation has not yet hinted a domain. */
export const DISCOVERY_SEQUENCE: CapabilityModuleId[] = [
  'interact',
  'understand',
  'think',
  'guide',
  'remember',
  'evolve',
];

/** Soft keyword hints — reveal related rings through use, not menus. */
const HINTS: { id: CapabilityModuleId; patterns: RegExp[] }[] = [
  {
    id: 'understand',
    patterns: [
      /sembol/i,
      /numerolog/i,
      /astrolo[jg]/i,
      /örüntü|oruntu/i,
      /katman/i,
      /gökyüz|gokyuz/i,
      /r[uü]ya|dream/i,
      /tarot/i,
    ],
  },
  {
    id: 'think',
    patterns: [/neden/i, /muhakeme/i, /sentez/i, /analiz/i, /arketip/i, /zaman çiz|zaman ciz/i],
  },
  {
    id: 'remember',
    patterns: [/hatırla|hatirla/i, /ar[sş]iv/i, /geçen|gecen/i, /önceki|onceki/i, /bellek/i],
  },
  {
    id: 'guide',
    patterns: [/karar/i, /ne yapmal/i, /öner|oner/i, /yansıt|yansit/i, /rehber/i],
  },
  {
    id: 'interact',
    patterns: [/telegram/i, /ses(li)?/i, /konu[sş]/i, /yaz/i],
  },
  {
    id: 'evolve',
    patterns: [/öğren|ogren/i, /tercih/i, /beni tanı|beni tani/i, /alış|alis/i],
  },
];

export function getModule(id: CapabilityModuleId): CapabilityModule {
  const mod = capabilityModules.find((m) => m.id === id);
  if (!mod) throw new Error(`Unknown capability module: ${id}`);
  return mod;
}

/** Modules hinted by the user's own words in this session. */
export function inferHintedModules(userTexts: string[]): CapabilityModuleId[] {
  const blob = userTexts.join('\n');
  const found: CapabilityModuleId[] = [];
  for (const hint of HINTS) {
    if (hint.patterns.some((re) => re.test(blob))) found.push(hint.id);
  }
  return found;
}

/**
 * How many rings may surface after N completed exchanges.
 * Starts at 0 — speak first. Grows slowly. Never dumps the full map.
 */
export function discoveryAllowance(completedExchanges: number): number {
  if (completedExchanges < DISCOVERY_MIN_EXCHANGES) return 0;
  if (completedExchanges < 2) return 1;
  if (completedExchanges < 4) return 2;
  if (completedExchanges < 7) return 3;
  return 4; // hard cap — never all six at once as a feature wall
}

/**
 * Ordered list of modules the user has earned the right to glimpse.
 */
export function resolveDiscoveredModules(
  completedExchanges: number,
  userTexts: string[],
): CapabilityModule[] {
  const allowance = discoveryAllowance(completedExchanges);
  if (allowance === 0) return [];

  const hinted = inferHintedModules(userTexts);
  const ordered: CapabilityModuleId[] = [];

  for (const id of hinted) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  for (const id of DISCOVERY_SEQUENCE) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  return ordered.slice(0, allowance).map(getModule);
}

export const discoveryCopy = {
  emptyInvite: {
    line1: 'Ben Atlas.',
    line2: 'Hazırsan başlayabiliriz.',
  },
} as const;
