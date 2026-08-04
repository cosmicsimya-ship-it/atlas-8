/**
 * Daily Analysis flow — thin integration point for Telegram/Web (Faz A/B).
 * Not wired into atlas-message-service yet.
 * Returns JSON data only; no narrative reply.
 */
import { buildDailyAnalysis, LAYER_REGISTRY } from './daily-analysis/index.js';

export const DAILY_ANALYSIS_FLOW_VERSION = 'atlas-daily-analysis-flow-v1';

/**
 * @param {string} message
 * @returns {'daily_analysis'|'daily_analysis_hours'|null}
 */
export function detectDailyAnalysisIntent(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  const lower = text.toLocaleLowerCase('tr-TR');

  if (/kader|kesin\s+olacak|fal\b|kehanet/.test(lower)) {
    return null;
  }

  if (
    /katmanl[ıi]\s+g[uü]nl[uü]k|g[uü]nl[uü]k\s+analiz|daily\s+analysis|layered\s+daily/i.test(
      lower,
    )
  ) {
    return 'daily_analysis';
  }

  if (/gezegen\s+saat/i.test(lower) && /bug[uü]n|g[uü]n|saat/i.test(lower)) {
    return 'daily_analysis_hours';
  }

  return null;
}

/**
 * @param {{
 *   message: string,
 *   date?: Date|string|number,
 *   timezone?: string,
 *   latitude?: number,
 *   longitude?: number,
 *   locale?: string,
 * }} input
 */
export function tryDailyAnalysis(input) {
  const intent = detectDailyAnalysisIntent(input.message);
  if (!intent) return null;

  const layers =
    intent === 'daily_analysis_hours'
      ? ['sun-times', 'planetary-hours', 'weekday']
      : undefined;

  const report = buildDailyAnalysis({
    date: input.date,
    timezone: input.timezone,
    latitude: input.latitude,
    longitude: input.longitude,
    locale: input.locale,
    layers,
  });

  return {
    intent,
    flowVersion: DAILY_ANALYSIS_FLOW_VERSION,
    report,
    reply: null,
    availableLayers: Object.keys(LAYER_REGISTRY),
  };
}
