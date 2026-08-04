const INTRO_SEEN_KEY = 'cosmicsimya_intro_seen';
const FORM_DRAFT_KEY = 'cosmicsimya_analysis_draft';

export function hasSeenIntro(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(INTRO_SEEN_KEY) === '1';
}

export function markIntroSeen(): void {
  localStorage.setItem(INTRO_SEEN_KEY, '1');
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function loadFormDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(FORM_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveFormDraft<T>(draft: T): void {
  localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(draft));
}

export function clearFormDraft(): void {
  localStorage.removeItem(FORM_DRAFT_KEY);
}
