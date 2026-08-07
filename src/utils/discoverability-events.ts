/**
 * Discoverability analytics readiness — no third-party vendor.
 * Emits CustomEvent + keeps a small session ring for later wiring.
 */

export type DiscoverabilityEventName =
  | 'empty_state_seen'
  | 'trace_selected'
  | 'multiple_traces_selected'
  | 'first_message_sent'
  | 'first_message_without_trace'
  | 'first_message_with_trace';

export type DiscoverabilityEventPayload = {
  name: DiscoverabilityEventName;
  at: number;
  detail?: Record<string, unknown>;
};

const RING_KEY = 'atlas.discoverability.events.v1';
const RING_MAX = 40;
const EVENT_TYPE = 'atlas:discoverability';

function pushRing(entry: DiscoverabilityEventPayload): void {
  try {
    const raw = sessionStorage.getItem(RING_KEY);
    const list: DiscoverabilityEventPayload[] = raw ? JSON.parse(raw) : [];
    list.push(entry);
    while (list.length > RING_MAX) list.shift();
    sessionStorage.setItem(RING_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function trackDiscoverability(
  name: DiscoverabilityEventName,
  detail?: Record<string, unknown>,
): void {
  const entry: DiscoverabilityEventPayload = {
    name,
    at: Date.now(),
    detail,
  };
  pushRing(entry);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EVENT_TYPE, {
        detail: entry,
      }),
    );
  }

  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[discoverability]', name, detail ?? {});
  }
}

export function readDiscoverabilityRing(): DiscoverabilityEventPayload[] {
  try {
    const raw = sessionStorage.getItem(RING_KEY);
    return raw ? (JSON.parse(raw) as DiscoverabilityEventPayload[]) : [];
  } catch {
    return [];
  }
}
